<!-- 
For licensing see accompanying LICENSE file.
Copyright (C) 2023 Apple Inc. All Rights Reserved.
-->

<script lang="ts">
  import TableView from './components/table-view/TableView.svelte';
  import SetView from './components/set-view/SetView.svelte';
  import { fly } from 'svelte/transition';
  import { cubicInOut } from 'svelte/easing';
  import Tooltip from './Tooltip.svelte';
  import type { ChallengeStoreValue } from './store';
  import {
    getTooltipStore,
    getChallengeStore,
    getChallengeStoreDefaultValue
  } from './store';

  const tooltipStore = getTooltipStore();
  const challengeStore = getChallengeStore();
  let challengeStoreValue: ChallengeStoreValue =
    getChallengeStoreDefaultValue();

  const optionClicked = (type: string) => {
    if (challengeStoreValue.selectedTypes.has(type)) {
      challengeStoreValue.selectedTypes.delete(type);
    } else {
      challengeStoreValue.selectedTypes.add(type);
    }
    challengeStore.set(challengeStoreValue);
  };

  challengeStore.subscribe(value => {
    challengeStoreValue = value;
  });
</script>

<style lang="scss">
  @import './App.scss';
</style>

<div class="main-app">
  <div class="main-top">
    <div class="title">Angler</div>
    <div class="tagline">
      Exploring and curating machine translation challenge sets!
    </div>
  </div>

  <div class="main-left">
    <div class="title">Set Source</div>
    <div
      class="option topic"
      class:selected={challengeStoreValue.selectedTypes.has('topic')}
      on:click={() => optionClicked('topic')}
    >
      Unfamiliar Topics
    </div>
    <div
      class="option test"
      class:selected={challengeStoreValue.selectedTypes.has('test')}
      on:click={() => optionClicked('test')}
    >
      Unit Test Failures
    </div>
  </div>

  <div class="main-view">
    <div
      class="table-view-container"
      class:dehighlight={challengeStoreValue.selectedFileName !== ''}
    >
      <TableView {tooltipStore} {challengeStore} />
    </div>
    {#if challengeStoreValue.selectedFileName !== ''}
      <!-- {#if true} -->
      <div
        class="detail-view-container"
        transition:fly={{
          x: 1000,
          duration: 700,
          opacity: 1,
          ease: cubicInOut
        }}
      >
        <SetView {tooltipStore} {challengeStore} />
      </div>
    {/if}
  </div>
  <Tooltip {tooltipStore} />
</div>
