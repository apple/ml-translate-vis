<!-- 
For licensing see accompanying LICENSE file.
Copyright (C) 2023 Apple Inc. All Rights Reserved.
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import Filter from '../filter/Filter.svelte';
  import { Embedding } from './Embedding';
  import { tick } from 'svelte';
  import type { Writable } from 'svelte/store';
  import type {
    TooltipStoreValue,
    ChallengeStoreValue,
    TimelineStoreValue,
    EmbeddingSettingStoreValue
  } from '../../store';
  import type { ChallengeSet, ChallengeData } from '../../CustomTypes';
  import { getTimelineStore, getEmbeddingSettingStore } from '../../store';
  import iconContour from '../../imgs/icon-contour.svg?raw';

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;
  export let challengeSet: ChallengeSet | null = null;
  export let challengeData: ChallengeData | null = null;
  export let focusPosition: number | null = null;
  export let embeddingSettingStore: Writable<EmbeddingSettingStoreValue> | null =
    null;

  const timelineStore: Writable<TimelineStoreValue> = getTimelineStore();
  // const embeddingSettingStore: Writable<EmbeddingSettingStoreValue> =
  //   getEmbeddingSettingStore();

  let mounted = false;
  let component: HTMLElement | null = null;
  let initialized = false;
  let myEmbedding: Embedding | null = null;

  onMount(() => {
    mounted = true;
  });

  const embeddingUpdated = () => {
    myEmbedding = myEmbedding;
  };

  const initView = () => {
    if (
      mounted &&
      component &&
      tooltipStore &&
      challengeSet &&
      challengeData &&
      focusPosition &&
      embeddingSettingStore
    ) {
      initialized = true;

      // Initialize the embedding object
      myEmbedding = new Embedding({
        component,
        challengeSet,
        challengeData,
        focusPosition,
        embeddingUpdated,
        tooltipStore,
        timelineStore,
        embeddingSettingStore
      });
    }
  };

  $: mounted &&
    component &&
    tooltipStore &&
    challengeSet &&
    challengeData &&
    initView();
</script>

<style type="scss">
  @import './Embedding.scss';
</style>

<div class="embedding-wrapper" bind:this={component}>
  <div class="embedding">
    <div class="embedding-title" data-content="Sentence Embedding">
      Sentence Embedding
    </div>
    <div class="legend-panel">
      <div class="legend-grid">
        {#if myEmbedding?.embeddingSettingStoreValue.showLogSample}
          <div class="grid-item center">
            <div class="circle log" />
          </div>

          <div class="grid-item-">
            <span class="label"> Usage log sample </span>
          </div>
        {/if}

        {#if myEmbedding?.embeddingSettingStoreValue.showTrainSample}
          <div class="grid-item center">
            <div class="circle train" />
          </div>

          <div class="grid-item">
            <span class="label"> Training sample </span>
          </div>
        {/if}

        <div class="grid-item center">
          <span class="svg-icon train">
            {@html iconContour}
          </span>
        </div>

        <div class="grid-item">
          <span class="label"> Training density </span>
        </div>

        {#if myEmbedding?.embeddingSettingStoreValue.showLogContour}
          <div class="grid-item center">
            <span class="svg-icon log">
              {@html iconContour}
            </span>
          </div>
          <span class="label"> Usage log density </span>
        {/if}
      </div>

      <!-- <div class="points">
        <div class="train-point">
          <div class="circle" />
          <span class="label"> Training sample </span>
        </div>
        <div class="log-point">
          <div class="circle" />
          <span class="label"> Usage Log sample </span>
        </div>
      </div>

      <div class="contours">
        <div class="train-contour">
          <span class="svg-icon">
            {@html iconContour}
          </span>
          <span class="label"> Training density </span>
        </div>
        <div class="log-contour">
          <span class="svg-icon">
            {@html iconContour}
          </span>
          <span class="label"> Usage Log density </span>
        </div>
      </div> -->
    </div>
    <div class="control-panel">
      <Filter {embeddingSettingStore} />
    </div>
    <svg class="embedding-svg" />
  </div>
</div>
