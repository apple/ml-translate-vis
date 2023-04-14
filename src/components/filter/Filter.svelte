<!-- 
For licensing see accompanying LICENSE file.
Copyright (C) 2023 Apple Inc. All Rights Reserved.
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import { Filter } from './Filter';
  import type { Writable } from 'svelte/store';
  import type { EmbeddingSettingStoreValue } from '../../store';
  import { getEmbeddingSettingStoreDefaultValue } from '../../store';
  import iconGear from '../../imgs/icon-gear.svg?raw';

  export let embeddingSettingStore: Writable<EmbeddingSettingStoreValue> | null =
    null;

  let mounted = false;
  let component: HTMLElement | null = null;
  let initialized = false;
  let unpinned = true;
  let embeddingSetting: EmbeddingSettingStoreValue =
    getEmbeddingSettingStoreDefaultValue();

  onMount(() => {
    mounted = true;
  });

  const initView = () => {
    if (mounted && component && embeddingSettingStore) {
      initialized = true;

      embeddingSettingStore.subscribe(value => {
        embeddingSetting = value;
      });
    }
  };

  const gearClicked = () => {
    unpinned = !unpinned;
  };

  const sampleToggleClicked = () => {
    if (embeddingSetting.curSampleMethod === 'unfamiliar') {
      embeddingSetting.curSampleMethod = 'random';
    } else {
      embeddingSetting.curSampleMethod = 'unfamiliar';
    }
    embeddingSettingStore?.set(embeddingSetting);
  };

  const sampleSliderChanged = (e: InputEvent) => {
    const slider = e.target as HTMLInputElement;
    embeddingSetting.curSample = parseInt(slider.value);
    embeddingSettingStore?.set(embeddingSetting);
  };

  const logContourCheckboxToggled = (e: InputEvent) => {
    const checkbox = e.target as HTMLInputElement;
    embeddingSetting.showLogContour = checkbox.checked;
    embeddingSettingStore?.set(embeddingSetting);
  };

  const logSampleCheckboxToggled = (e: InputEvent) => {
    const checkbox = e.target as HTMLInputElement;
    embeddingSetting.showLogSample = checkbox.checked;
    embeddingSettingStore?.set(embeddingSetting);
  };

  const trainSampleCheckboxToggled = (e: InputEvent) => {
    const checkbox = e.target as HTMLInputElement;
    embeddingSetting.showTrainSample = checkbox.checked;
    embeddingSettingStore?.set(embeddingSetting);
  };

  $: mounted && initView();
</script>

<style type="scss">
  @import './Filter.scss';
</style>

<div class="filter-wrapper" bind:this={component} class:unpinned>
  <div class="filter">
    <div class="header">
      <div class="icon-wrapper" on:click={e => gearClicked(e)}>
        <div class="svg-icon">
          {@html iconGear}
        </div>
      </div>
      <div class="header-name">Settings</div>
    </div>
    <!-- <div class="config-row tb">
      <div class="sampling-toggle">
        <div
          class="toggle-item"
          class:selected={embeddingSetting.curSampleMethod === 'unfamiliar'}
          on:click={sampleToggleClicked}
        >
          Unfamiliar
        </div>
        <div
          class="toggle-item"
          class:selected={embeddingSetting.curSampleMethod !== 'unfamiliar'}
          on:click={sampleToggleClicked}
        >
          Random
        </div>
      </div>

      <input
        type="range"
        min={embeddingSetting.sampleMin}
        max={embeddingSetting.sampleMax}
        value={embeddingSetting.curSample}
        class="slider"
        id="sample-slider"
        on:input={e => sampleSliderChanged(e)}
      />
    </div> -->

    <div class="config-row">
      <input
        type="checkbox"
        class="log-contour-checkbox"
        id="log-contour"
        checked={embeddingSetting.showLogContour}
        on:input={e => logContourCheckboxToggled(e)}
      />
      <label class="log-contour-label" for="log-contour"
        >Usage log density</label
      >
    </div>

    <div class="config-row">
      <input
        type="checkbox"
        class="log-sample-checkbox"
        id="log-sample"
        checked={embeddingSetting.showLogSample}
        on:input={e => logSampleCheckboxToggled(e)}
      />
      <label class="log-contour-label" for="log-sample">Usage log sample</label>
    </div>

    <div class="config-row">
      <input
        type="checkbox"
        class="train-sample-checkbox"
        id="train-sample"
        checked={embeddingSetting.showTrainSample}
        on:input={e => trainSampleCheckboxToggled(e)}
      />
      <label class="log-contour-label" for="train-sample">Training sample</label
      >
    </div>
  </div>
</div>
