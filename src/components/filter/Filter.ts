// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { config } from '../../config';
import d3 from '../../utils/d3-import';
import type { Padding, DailyData, DailyPoint } from 'src/CustomTypes';
import type { Writable } from 'svelte/store';

export class Filter {
  component: HTMLElement;

  constructor({ component }: { component: HTMLElement }) {
    this.component = component;
  }
}
