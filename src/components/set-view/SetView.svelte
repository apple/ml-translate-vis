<!-- 
For licensing see accompanying LICENSE file.
Copyright (C) 2023 Apple Inc. All Rights Reserved.
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import d3 from '../../utils/d3-import';
  import { SetView } from './SetView';
  import Embedding from '../embedding/Embedding.svelte';
  import type {
    ChallengeSet,
    ChallengeData,
    ChallengeSetMeta,
    Header
  } from '../../CustomTypes';
  import { HeaderKey, ChallengeSetType } from '../../CustomTypes';
  import type { Writable } from 'svelte/store';
  import type {
    TooltipStoreValue,
    ChallengeStoreValue,
    TimelineStoreValue,
    EmbeddingSettingStoreValue
  } from '../../store';
  import {
    getTimelineStore,
    getChallengeStoreDefaultValue,
    getEmbeddingSettingStore
  } from '../../store';
  import iconTriangle from '../../imgs/icon-triangle-down.svg?raw';
  import iconEdit from '../../imgs/icon-edit.svg?raw';
  import iconDownload from '../../imgs/icon-download.svg?raw';
  import iconClose from '../../imgs/icon-close-circle.svg?raw';
  import iconList from '../../imgs/icon-checklist.svg?raw';
  import iconSearch from '../../imgs/icon-search.svg?raw';
  import iconInfo from '../../imgs/icon-info.svg?raw';
  import iconDelete from '../../imgs/icon-delete.svg?raw';

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;
  export let challengeStore: Writable<ChallengeStoreValue>;

  const headers: Header[] = [
    { displayName: 'Log Count', key: HeaderKey.logCount },
    { displayName: 'Familiarity', key: HeaderKey.familiarity },
    { displayName: 'Train Count', key: HeaderKey.trainCount },
    { displayName: 'ChrF', key: HeaderKey.chrf },
    { displayName: 'Train Ratio', key: HeaderKey.trainLogRatio }
  ];
  const thumbnailContents = [
    'keyword',
    'embedding',
    'chrf',
    'familiarity',
    'sourceid',
    'test'
  ];

  let mounted = false;
  let component: HTMLElement | null = null;
  let dialog: HTMLDialogElement | null = null;
  let initialized = false;
  let mySetView: SetView | null = null;
  let challengeSet: ChallengeSet | null = null;
  let challengeData: ChallengeData | null = null;
  let challengeStoreValue = getChallengeStoreDefaultValue();
  const embeddingSettingStore: Writable<EmbeddingSettingStoreValue> =
    getEmbeddingSettingStore();

  challengeStore.subscribe(value => {
    challengeStoreValue = value;
  });

  const timelineStore = getTimelineStore();
  const chrfFormatter = d3.format('.2f');
  const ctfidfFormatter = d3.format('.4f');
  const mySetViewUpdated = () => {
    mySetView = mySetView;
  };
  const DEV_MODE = false;

  const initSetData = () => {
    if (
      challengeStoreValue.challengeData === undefined ||
      challengeStoreValue.challengeSet === undefined
    ) {
      console.error(
        'challengeStoreValue is not updated before constructing the set view'
      );
      return;
    }

    challengeSet = challengeStoreValue.challengeSet;
    challengeData = challengeStoreValue.challengeData;
  };

  const initSetDataTest = async () => {
    const fileName = 'challenge-topic-5_views_4m_9m_ago';
    const challengeJSONData: ChallengeData | undefined = await d3.json(
      `${import.meta.env.BASE_URL}data/challenge-set/${fileName}.json`
    );

    if (challengeJSONData === undefined) {
      console.error(`Cannot load challenge set data ${fileName}.`);
      return;
    }

    challengeSet = {
      fileName: fileName,
      displayName: 'topic-5_views_4m_9m_ago',
      count: challengeJSONData.source.length,
      type: ChallengeSetType.Topic,
      chrf: 0.8643,
      familiarity: 0.6627,
      trainLogRatio: 0.3333
    };

    challengeData = challengeJSONData;
  };

  const getHeaderValue = (
    challengeSet: ChallengeSet | null,
    headerKey: HeaderKey
  ) => {
    if (challengeSet === null) return '';
    switch (headerKey) {
      case HeaderKey.chrf: {
        return chrfFormatter(challengeSet.chrf!);
      }
      case HeaderKey.trainCount: {
        return challengeSet.trainCount;
      }
      case HeaderKey.logCount: {
        return challengeSet.logCount;
      }
      case HeaderKey.familiarity: {
        return chrfFormatter(challengeSet.familiarity!);
      }
      case HeaderKey.trainLogRatio: {
        return `${Math.floor(challengeSet.trainLogRatio! * 100)}%`;
      }
    }
  };

  const checkboxChanged = (e: InputEvent) => {
    const checkbox = e.target as HTMLInputElement;
    localStorage.setItem(
      'skipSentenceDeleteWarning',
      checkbox.checked ? 'true' : 'false'
    );
  };

  onMount(async () => {
    mounted = true;

    if (DEV_MODE) {
      await initSetDataTest();
    } else {
      initSetData();
    }
  });

  const initView = () => {
    if (
      mounted &&
      component &&
      tooltipStore &&
      challengeStore &&
      challengeSet &&
      challengeData &&
      timelineStore
    ) {
      initialized = true;

      // Initialize the set view
      mySetView = new SetView({
        component,
        challengeSet,
        challengeData,
        mySetViewUpdated,
        tooltipStore,
        challengeStore,
        timelineStore,
        embeddingSettingStore
      });
    }
  };

  $: mounted &&
    tooltipStore &&
    challengeStore &&
    challengeSet &&
    challengeData &&
    timelineStore &&
    initView();
</script>

<style type="scss">
  @import './SetView.scss';
</style>

<div class="set-view-wrapper" bind:this={component}>
  <div class="header">
    <div class="left-content">
      <div class="svg-icon back-icon" on:click={() => mySetView?.backClicked()}>
        {@html iconTriangle}
      </div>

      <div class="name" contenteditable="true">
        {challengeSet === null ? 'Challenge Set' : challengeSet.displayName}
      </div>
      <div class="svg-icon edit-icon">
        {@html iconEdit}
      </div>
    </div>
    <div class="right-content">
      {#each headers as header}
        <div
          class="stat-item"
          on:mouseenter={e => mySetView?.headerMouseenter(e, header)}
          on:mouseleave={e => mySetView?.headerMouseleave(e, header)}
        >
          <span>{header.displayName}</span>
          <span>{getHeaderValue(challengeSet, header.key)}</span>
        </div>
      {/each}
    </div>
  </div>

  <div class="content">
    <div class="filter">
      <div class="filter-left">
        <span class="filter-name">Filters</span>

        {#if mySetView && mySetView.filterTags.length > 0}
          {#each mySetView.filterTags as tag}
            <div class="filter-item">
              <span>{tag.message}</span>
              <span
                class="svg-icon"
                on:click={() => mySetView?.tagCloseClicked(tag)}
              >
                {@html iconClose}
              </span>
            </div>
          {/each}
        {:else}
          <span
            class="svg-icon icon-info"
            on:mouseenter={e => mySetView?.filterHelperMouseenter(e)}
            on:mouseleave={e => mySetView?.filterHelperMouseleave(e)}
          >
            {@html iconInfo}
          </span>
        {/if}
      </div>

      <div
        class="filter-right"
        on:mouseenter={e => mySetView?.exportMouseEnter(e)}
        on:mouseleave={e => mySetView?.exportMouseLeave(e)}
        on:click={() => mySetView?.exportClicked()}
      >
        <span class="svg-icon">
          {@html iconDownload}
        </span>
        <span>Export</span>
      </div>
    </div>

    <div class="timeline">
      <svg class="timeline-svg" />
    </div>

    <div class="detail">
      <div class="vis-block">
        <div class="vis-focus">
          {#each [0, 1, 2, 3, 4, 5] as pos}
            <div
              class="vis-focus-plot"
              id={`focus-${pos}`}
              class:shown={mySetView?.curSelectedThumbnailID === pos}
            >
              <span
                class="svg-icon icon-info"
                class:embedding-info={pos === 1}
                on:mouseenter={e =>
                  mySetView?.filterHelperMouseenter(e, thumbnailContents[pos])}
                on:mouseleave={e => mySetView?.filterHelperMouseleave(e)}
              >
                {@html iconInfo}
              </span>
              {#if pos === 1}
                <svg class="focus-svg" style="display: none;" />
                <Embedding
                  {tooltipStore}
                  {challengeSet}
                  {challengeData}
                  {embeddingSettingStore}
                  focusPosition={pos}
                />
              {:else if pos === 0}
                <svg class="focus-svg" style="display: none;" />
                <div class="keyword-grid">
                  <div class="name">Most Representative Keywords</div>
                  <div class="keyword-wrapper">
                    {#if mySetView}
                      {#each mySetView.curKeywords as keyword}
                        <div
                          class="keyword"
                          class:selected={mySetView?.curSelectedKeywords.has(
                            keyword.word
                          )}
                          style={`background-color: ${keyword.color};`}
                          title={`${keyword.word}, c-TF-IDF: ${ctfidfFormatter(
                            keyword.value
                          )}`}
                          on:click={e => mySetView?.keywordClicked(keyword)}
                        >
                          {keyword.word}
                        </div>
                      {/each}
                    {/if}
                  </div>
                </div>
              {:else}
                <svg class="focus-svg" />
              {/if}
            </div>
          {/each}
        </div>

        <div class="vis-others">
          {#each [0, 1, 2, 3, 4, 5] as pos}
            <div
              class="thumbnail"
              id={`thumbnail-${pos}`}
              on:click={e => mySetView?.thumbnailClicked(e, pos)}
            >
              <div
                class="thumbnail-vis"
                class:selected={mySetView?.curSelectedThumbnailID === pos}
              >
                {#if pos === 0}
                  <svg class="thumbnail-svg" style="visibility: hidden;" />
                  <div class="keyword-thumbnail">
                    {#if mySetView}
                      {#each mySetView.curKeywords as keyword}
                        <div class="keyword">
                          {keyword.word}
                        </div>
                      {/each}
                    {/if}
                  </div>
                {:else}
                  <svg class="thumbnail-svg" />
                {/if}
              </div>
              <div class="vis-label">&nbsp;</div>
            </div>
          {/each}
        </div>
      </div>

      <div class="sentence-block">
        <div class="top-bar">
          <div class="search-bar">
            <span class="svg-icon">{@html iconSearch}</span>
            <input
              class="search-bar-input"
              type="text"
              id="input-search"
              on:input={e => mySetView?.searchKeyChanged(e)}
              placeholder="Type to search..."
            />
          </div>
          <div
            class="edit-button"
            class:edit-mode={mySetView?.editMode}
            on:click={mySetView?.editClicked()}
          >
            <span class="svg-icon">{@html iconList}</span>
            <span>Edit</span>
          </div>
        </div>
        <div class="sentence-list">
          <div id="sentence-list-count-label">
            <span class="log">{mySetView?.logCount} usage log samples</span>
            <span class="train"
              >{mySetView?.trainingCount} training samples</span
            >
          </div>
          {#if mySetView !== null}
            {#each mySetView.curSentences as sentence}
              <div
                class="sentence-row show-source"
                class:log={sentence.type === 'log'}
                class:edit-mode={mySetView?.editMode}
                on:click={() => {
                  sentence.showHyp = !sentence.showHyp;
                }}
              >
                <div class="sentence-source">
                  <div class="sentence-wrapper">
                    {@html mySetView?.displaySource(sentence)}
                  </div>
                  <div
                    class="delete-button"
                    class:shown={mySetView?.editMode}
                    on:click={e => {
                      const skipWarning = localStorage.getItem(
                        'skipSentenceDeleteWarning'
                      );
                      if (skipWarning === 'true') {
                        mySetView?.deleteClicked(e, sentence);
                      } else {
                        dialog?.addEventListener(
                          'close',
                          () => {
                            if (dialog?.returnValue === 'delete') {
                              mySetView?.deleteClicked(e, sentence);
                            }
                          },
                          { once: true }
                        );

                        dialog?.showModal();
                      }
                    }}
                  >
                    <span class="svg-icon">{@html iconDelete}</span>
                  </div>
                </div>
                <div class="sentence-hyp" class:shown={sentence.showHyp}>
                  {sentence.hyp === null
                    ? '[translation not available]'
                    : sentence.hyp}
                </div>
              </div>
            {/each}
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<dialog class="delete-alert" bind:this={dialog}>
  <div class="content">
    <div class="primary">Are you sure you want to delete this sentence?</div>
    <div class="secondary">This action is irreversible!</div>
  </div>
  <div class="checkbox-menu">
    <input
      id="warn-checkbox"
      type="checkbox"
      on:input={e => checkboxChanged(e)}
    /><label for="warn-checkbox">Don't warn me again</label>
  </div>
  <form method="dialog">
    <menu class="menu">
      <button value="cancel">Cancel</button>
      <button value="delete" class="action">Delete</button>
    </menu>
  </form>
</dialog>
