import { assert } from '@ember/debug';
import { action } from '@ember/object';
import { inject as service } from '@ember/service';
import { DEBUG } from '@glimmer/env';
import Modifier from 'ember-modifier';
import deepEqual from 'fast-deep-equal';
import { registerDestructor } from '@ember/destroyable';

const WATCHED_ELEMENTS = DEBUG ? new WeakSet() : undefined;

export default class InViewportModifier extends Modifier {
  @service inViewport;

  name = 'in-viewport';
  isInstalled = false;

  lastOptions;
  options;

  onEnterArg;
  onExitArg;

  constructor(owner, args) {
    super(owner, args);
    registerDestructor(this, this.destroyWatcher);
  }

  setOptions(named) {
    // eslint-disable-next-line no-unused-vars
    const { onEnter, onExit, ...options } = named;

    this.lastOptions = this.options;

    this.options = options;
    this.onEnterArg = onEnter;
    this.onExitArg = onExit;
  }

  get hasStaleOptions() {
    return !deepEqual(this.options, this.lastOptions);
  }

  validateArguments(positional, named) {
    assert(
      `'{{in-viewport}}' does not accept positional parameters. Specify listeners via 'onEnter' / 'onExit'.`,
      positional.length === 0
    );
    assert(
      `'{{in-viewport}}' either expects 'onEnter', 'onExit' or both to be present.`,
      typeof named.onEnter === 'function' || typeof named.onExit === 'function'
    );
  }

  @action
  onEnter(...args) {
    if (this.onEnterArg) {
      this.onEnterArg.call(null, this.savedElement, ...args);
    }

    if (!this.options.viewportSpy) {
      this.inViewport.stopWatching(this.savedElement);
    }
  }

  @action
  onExit(...args) {
    if (this.onExitArg) {
      this.onExitArg.call(null, this.savedElement, ...args);
    }
  }

  setupWatcher() {
    assert(
      `'${this.savedElement}' is already being watched. Make sure that '{{in-viewport}}' is only used once on this savedElementand that you are not calling 'inViewport.watchElement(element)' in other places.`,
      !WATCHED_ELEMENTS.has(this.savedElement)
    );
    if (DEBUG) WATCHED_ELEMENTS.add(this.savedElement);
    this.inViewport.watchElement(
      this.savedElement,
      this.options,
      this.onEnter,
      this.onExit
    );
    this.lastOptions = this.options;
  }

  @action
  destroyWatcher() {
    if (DEBUG) WATCHED_ELEMENTS.delete(this.savedElement);
    this.inViewport.stopWatching(this.savedElement);
  }

  modify(element, positionalArgs, namedArgs) {
    this.validateArguments(positionalArgs, namedArgs);
    this.setOptions(namedArgs);

    this.savedElement = element;

    if (!this.isInstalled) {
      this.setupWatcher();
      this.isInstalled = true;
    } else if (this.hasStaleOptions) {
      this.destroyWatcher();
      this.setupWatcher();
    }
  }
}
