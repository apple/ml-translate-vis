<!-- 
For licensing see accompanying LICENSE file.
Copyright (C) 2023 Apple Inc. All Rights Reserved.
-->

<script lang="ts">
  import { onMount } from 'svelte';
  import d3 from '../../utils/d3-import';
  import { TableView } from './TableView';
  import type {
    ChallengeSet,
    ChallengeData,
    ChallengeSetMeta,
    Header
  } from '../../CustomTypes';
  import { HeaderKey } from '../../CustomTypes';
  import type { Writable } from 'svelte/store';
  import type {
    TooltipStoreValue,
    ChallengeStoreValue,
    TimelineStoreValue,
    EmbeddingSettingStoreValue
  } from '../../store';
  import {
    getTimelineStore,
    getEmbeddingSettingStore,
    getChallengeStoreDefaultValue
  } from '../../store';
  import iconTriangle from '../../imgs/icon-triangle-down.svg?raw';
  import iconSearch from '../../imgs/icon-search.svg?raw';
  import iconInfo from '../../imgs/icon-info.svg?raw';

  export let tooltipStore: Writable<TooltipStoreValue> | null = null;
  export let challengeStore: Writable<ChallengeStoreValue> | null = null;
  let challengeStoreValue: ChallengeStoreValue =
    getChallengeStoreDefaultValue();

  let mounted = false;
  let challengeMetaInitialized = false;
  let component: HTMLElement | null = null;
  let initialized = false;
  let myTableView: TableView | null = null;
  const challengeSetDataMap: Map<string, ChallengeData> = new Map();

  let curSortHeader = {
    key: HeaderKey.logCount,
    direction: 'down'
  };
  const chrfFormatter = d3.format('.2f');
  const ctfidfFormatter = d3.format('.4f');
  const percentFormatter = d3.format(',%');
  let challengeSearchResults = new Set<string>([]);
  let noSearchResults = false;

  let cache: Cache | null = null;

  const headers: Header[] = [
    { displayName: 'Challenge Set', key: HeaderKey.displayName },
    { displayName: 'Log Count', key: HeaderKey.logCount },
    { displayName: 'Familiarity', key: HeaderKey.familiarity },
    { displayName: 'Train Count', key: HeaderKey.trainCount },
    { displayName: 'ChrF', key: HeaderKey.chrf },
    { displayName: 'Train Ratio', key: HeaderKey.trainLogRatio }
  ];

  let challengeMeta: {
    headers: Header[];
    challengeSets: ChallengeSet[];
  } = {
    headers: headers,
    challengeSets: []
  };

  const myTableViewUpdated = () => {
    myTableView = myTableView;
  };

  const updateChallengeMeta = () => {
    challengeMeta = challengeMeta;
  };

  // Load the table meta information
  const initTableData = async () => {
    console.time('Reading challenge sets');

    cache = await caches.open('cache');

    const tableJSONData: ChallengeSetMeta | undefined = await d3.json(
      `${import.meta.env.BASE_URL}data/challenge-sets.json`
    );

    if (tableJSONData === undefined) {
      console.error('Cannot load table meta data.');
      return;
    }

    for (const challengeSet of tableJSONData.challengeSets) {
      try {
        // Load all related json files
        let challengeJSONData: ChallengeData | undefined = undefined;

        // Check if the json file is cached
        const JSON_URL = `${import.meta.env.BASE_URL}data/challenge-set/${
          challengeSet.fileName
        }.json`;
        const response = await cache.match(JSON_URL);

        // If the file was cached
        if (response) {
          challengeJSONData = (await response.json()) as ChallengeData;
        } else {
          // Save the json file to cache
          await cache.add(JSON_URL);
          const newResponse = await cache.match(JSON_URL);
          challengeJSONData = (await newResponse?.json()) as ChallengeData;
        }

        // Update challenge set meta fields
        challengeSet.count = challengeJSONData.source.length;

        // Compute log and train count
        challengeSet.trainCount = challengeJSONData.train.reduce(
          (a, b) => a + b
        );
        challengeSet.logCount = challengeSet.count - challengeSet.trainCount;

        const trainSum = challengeJSONData.train.reduce((a, b) => a + b);
        challengeSet.trainLogRatio = trainSum / challengeSet.count;

        const chrfSum = challengeJSONData.chrf.reduce(
          (a, b): number => (a === null ? 0 : a) + (b === null ? 0 : b)
        );
        const chrfCount = challengeJSONData.chrf.filter(
          (d): d is number => d !== null
        ).length;

        // Avoid dividing by 0
        if (chrfCount === 0) {
          challengeSet.chrf = undefined;
        } else {
          challengeSet.chrf = chrfSum / chrfCount;
        }

        const familiaritySum = challengeJSONData.familiarity.reduce(
          (a, b): number => (a === null ? 0 : a) + (b === null ? 0 : b)
        );
        const familiarityCount = challengeJSONData.familiarity.filter(
          (d): d is number => d !== null
        ).length;
        challengeSet.familiarity = familiaritySum / familiarityCount;

        challengeMeta.challengeSets.push(challengeSet);

        // Store the loaded challenge set data
        challengeSetDataMap.set(challengeSet.fileName, challengeJSONData);
      } catch (error) {
        console.error(error);
      }
    }

    console.timeEnd('Reading challenge sets');

    // Sort the challenge sets with the default sorting key
    sortChallengeSetsInPlace(
      challengeMeta.challengeSets,
      curSortHeader.key,
      curSortHeader.direction
    );
    updateChallengeMeta();
    challengeMetaInitialized = true;
  };

  /**
   * Sort the given challenge set array in place
   * @param challengeSets Challenge sets
   * @param key Sort key
   * @param direction Sort direction
   */
  const sortChallengeSetsInPlace = (
    challengeSets: ChallengeSet[],
    key: HeaderKey,
    direction: string
  ) => {
    switch (key) {
      case HeaderKey.displayName: {
        // If they key is displayName, then we need to sort the sets by string
        // values
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return a.displayName.localeCompare(b.displayName);
          } else {
            return -a.displayName.localeCompare(b.displayName);
          }
        });
        break;
      }

      case HeaderKey.trainCount: {
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return a.trainCount - b.trainCount;
          } else {
            return b.trainCount - a.trainCount;
          }
        });
        break;
      }

      case HeaderKey.logCount: {
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return a.logCount - b.logCount;
          } else {
            return b.logCount - a.logCount;
          }
        });
        break;
      }

      case HeaderKey.chrf: {
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return (a.chrf ? a.chrf : 0) - (b.chrf ? b.chrf : 0);
          } else {
            return (b.chrf ? b.chrf : 0) - (a.chrf ? a.chrf : 0);
          }
        });
        break;
      }

      case HeaderKey.familiarity: {
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return (
              (a.familiarity ? a.familiarity : 0) -
              (b.familiarity ? b.familiarity : 0)
            );
          } else {
            return (
              (b.familiarity ? b.familiarity : 0) -
              (a.familiarity ? a.familiarity : 0)
            );
          }
        });
        break;
      }

      case HeaderKey.trainLogRatio: {
        challengeSets.sort((a, b) => {
          if (direction === 'up') {
            return (
              (a.trainLogRatio ? a.trainLogRatio : 0) -
              (b.trainLogRatio ? b.trainLogRatio : 0)
            );
          } else {
            return (
              (b.trainLogRatio ? b.trainLogRatio : 0) -
              (a.trainLogRatio ? a.trainLogRatio : 0)
            );
          }
        });
      }
    }
  };

  /**
   * Event handler for sort icon clicking
   * @param direction "up" or "down"
   * @param header The header name
   */
  const sortIconClicked = (direction: string, header: Header) => {
    curSortHeader.key = header.key;
    curSortHeader.direction = direction;
    curSortHeader = curSortHeader;

    // Sort the challenge sets
    sortChallengeSetsInPlace(
      challengeMeta.challengeSets,
      curSortHeader.key,
      curSortHeader.direction
    );
    updateChallengeMeta();
  };

  /**
   * Event handler for header clicking. It makes the table sort rows by the
   * clicked column with ascending order. If the clicked column is the current
   * sort key, reverse the direction.
   * @param direction "up" or "down"
   * @param header The header name
   */
  const headerClicked = (header: Header) => {
    if (curSortHeader.key === header.key) {
      if (curSortHeader.direction === 'up') {
        curSortHeader.direction = 'down';
      } else {
        curSortHeader.direction = 'up';
      }
    } else {
      curSortHeader.key = header.key;
      curSortHeader.direction = 'up';
    }

    curSortHeader = curSortHeader;

    // Sort the challenge sets
    sortChallengeSetsInPlace(
      challengeMeta.challengeSets,
      curSortHeader.key,
      curSortHeader.direction
    );
    updateChallengeMeta();
  };

  /**
   * Event handler for input change in the search bar
   */
  const searchKeyChanged = (e: InputEvent | null) => {
    let searchKey: string;
    noSearchResults = false;

    if (e !== null) {
      searchKey = d3
        .select(e.target as HTMLElement)
        .property('value') as string;
    } else {
      searchKey = '';
    }

    challengeSearchResults.clear();
    let empty = true;

    for (const challengeSet of challengeMeta.challengeSets) {
      if (
        challengeSet.fileName.toLowerCase().includes(searchKey.toLowerCase())
      ) {
        challengeSearchResults.add(challengeSet.fileName);
        empty = false;
      }
    }

    if (searchKey !== '' && empty) {
      challengeSearchResults.add('■');
      noSearchResults = true;
    }

    challengeSearchResults = challengeSearchResults;
  };

  onMount(async () => {
    await initTableData();
    mounted = true;
  });

  const initView = () => {
    if (
      mounted &&
      component &&
      tooltipStore &&
      challengeStore &&
      challengeMetaInitialized
    ) {
      challengeStore.subscribe(value => {
        challengeStoreValue = value;
      });

      initialized = true;

      // Initialize the embedding object
      myTableView = new TableView({
        component,
        myTableViewUpdated,
        challengeSets: challengeMeta.challengeSets,
        challengeSetDataMap,
        tooltipStore,
        challengeStore
      });
    }
  };

  $: mounted &&
    !initialized &&
    component &&
    tooltipStore &&
    challengeStore &&
    challengeMetaInitialized &&
    initView();
</script>

<style type="scss">
  @import './TableView.scss';
</style>

<div class="table-view-wrapper" bind:this={component}>
  <table class="table">
    <thead>
      <tr>
        {#each challengeMeta.headers as header, i}
          <th colspan={i === 0 ? '' : '2'} class="header-cell">
            <div
              class="header-cell-content"
              on:mouseenter={e => myTableView?.headerMouseenter(e, header)}
              on:mouseleave={e => myTableView?.headerMouseleave(e, header)}
            >
              <span on:click={() => headerClicked(header)}
                >{header.displayName}</span
              >
              <div
                class="sort-icons"
                class:active-up={curSortHeader.key === header.key &&
                  curSortHeader.direction === 'up'}
                class:active-down={curSortHeader.key === header.key &&
                  curSortHeader.direction === 'down'}
              >
                <div
                  class="svg-icon icon-sort-up"
                  on:click={() => sortIconClicked('up', header)}
                >
                  {@html iconTriangle}
                </div>
                <div
                  class="svg-icon icon-sort-down"
                  on:click={() => sortIconClicked('down', header)}
                >
                  {@html iconTriangle}
                </div>
              </div>

              {#if i === 0}
                <div class="search-bar">
                  <span class="svg-icon">{@html iconSearch}</span>
                  <input
                    class="search-bar-input"
                    type="text"
                    id="input-search"
                    on:input={e => searchKeyChanged(e)}
                    placeholder="Search..."
                  />
                </div>
              {/if}
            </div>
          </th>
        {/each}
      </tr>
    </thead>

    <tbody>
      {#each challengeMeta.challengeSets as challengeSet (challengeSet.fileName)}
        <tr
          class="hoverrable"
          class:selected={myTableView?.selectedSetName ===
            challengeSet.fileName}
          class:hide={(challengeStoreValue.selectedTypes.size > 0 &&
            !challengeStoreValue.selectedTypes.has(
              challengeSet.type === 'topic' ? 'topic' : 'test'
            )) ||
            (challengeSearchResults.size > 0 &&
              !challengeSearchResults.has(challengeSet.fileName))}
          on:click={() => {
            myTableView?.rowClicked(challengeSet);
          }}
        >
          <td class="td-name"
            ><div class="cell cell-label" title={challengeSet.displayName}>
              {challengeSet.displayName}
            </div></td
          >

          <td class="td-log-count td-plot">
            <div class="cell cell-plot">
              <svg
                class="cell-svg cell-svg-log-count"
                id={`cell-log-count-${challengeSet.fileName}`}
              />
            </div>
          </td>
          <td class="td-log-count td-label">
            <div class="cell cell-label log">
              {challengeSet.logCount}
            </div>
          </td>

          <td class="td-familiarity td-plot"
            ><div class="cell cell-plot">
              <svg
                class="cell-svg cell-svg-familiarity"
                id={`cell-familiarity-${challengeSet.fileName}`}
              />
            </div>
          </td>
          <td class="td-familiarity td-label"
            ><div class="cell cell-label log">
              <div>
                {challengeSet.familiarity === undefined
                  ? '0.00'
                  : chrfFormatter(challengeSet.familiarity)}
              </div>
            </div>
          </td>

          <td class="td-train-count td-plot"
            ><div class="cell cell-plot">
              <svg
                class="cell-svg cell-svg-train-count"
                id={`cell-train-count-${challengeSet.fileName}`}
              />
            </div></td
          >
          <td class="td-train-count td-label"
            ><div class="cell cell-label train">
              {challengeSet.trainCount}
            </div></td
          >

          <td class="td-chrf td-plot">
            <div class="cell cell-plot">
              <svg
                class="cell-svg cell-svg-chrf"
                id={`cell-chrf-${challengeSet.fileName}`}
              />
            </div>
          </td>
          <td class="td-chrf td-label">
            <div class="cell cell-label train">
              <div>
                {challengeSet.chrf === undefined
                  ? 'N/A'
                  : chrfFormatter(challengeSet.chrf)}
              </div>
            </div>
          </td>

          <td class="td-ratio td-plot">
            <div class="cell cell-plot">
              <svg
                class="cell-svg cell-svg-ratio"
                id={`cell-ratio-${challengeSet.fileName}`}
              />
            </div></td
          >
          <td class="td-ratio td-label">
            <div class="cell cell-label">
              <div>
                {challengeSet.trainLogRatio === undefined
                  ? '0.00'
                  : `${Math.floor(challengeSet.trainLogRatio * 100)}%`}
              </div>
            </div></td
          >
        </tr>
        <tr
          class="detail-row"
          class:hide={(challengeStoreValue.selectedTypes.size > 0 &&
            !challengeStoreValue.selectedTypes.has(
              challengeSet.type === 'topic' ? 'topic' : 'test'
            )) ||
            (challengeSearchResults.size > 0 &&
              !challengeSearchResults.has(challengeSet.fileName))}
        >
          <td
            class:hidden={myTableView?.selectedSetName !==
              challengeSet.fileName}
            colspan="11"
          >
            <div class="detail-content">
              <div class="sentence-block">
                <div class="name">
                  <span class="name-label">Sample Sentences</span>
                </div>
                <div class="sentence-list">
                  {#if myTableView !== null}
                    {#each myTableView.selectedSetSentences as sentence}
                      <div
                        class="sentence-row"
                        on:click={() => {
                          sentence.showHyp = !sentence.showHyp;
                        }}
                      >
                        <div class="sentence-source">{sentence.source}</div>
                        <div
                          class="sentence-hyp"
                          class:shown={sentence.showHyp}
                        >
                          {sentence.hyp}
                        </div>
                      </div>
                    {/each}
                  {/if}
                </div>
              </div>

              <div class="separator" />

              <div class="keyword-block">
                <div class="name">
                  <div class="name-left">
                    <span class="name-label">Keywords</span>
                    <span
                      class="svg-icon icon-info"
                      on:mouseenter={e =>
                        myTableView?.filterHelperMouseenter(e, 'keyword')}
                      on:mouseleave={e =>
                        myTableView?.filterHelperMouseleave(e)}
                      >{@html iconInfo}</span
                    >
                  </div>

                  <div
                    class="detail-button"
                    on:click={() =>
                      myTableView?.showDetailClicked(challengeSet)}
                  >
                    Show Details
                  </div>
                </div>
                <div class="keyword-grid">
                  <div class="keyword-wrapper">
                    {#if myTableView !== null}
                      {#each myTableView.selectedSetKeywords as keyword}
                        <div
                          class="keyword"
                          style={`background-color: ${keyword.color};`}
                          title={`${keyword.word}, c-TF-IDF: ${ctfidfFormatter(
                            keyword.value
                          )}`}
                        >
                          {keyword.word}
                        </div>
                      {/each}
                      <div class="keyword phantom" />
                    {/if}
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      {/each}
    </tbody>
  </table>

  {#if !initialized}
    <div class="loading-placeholder">
      <span class="loader-label">Loading</span>
      <span class="loader" />
    </div>
  {/if}

  <!-- {#if challengeStoreValue.selectedTypes.size === 0}
    <div class="empty-placeholder">
      <span class="loader-label">Select at least one challenge set type</span>
    </div>
  {/if} -->

  {#if noSearchResults}
    <div class="empty-placeholder">
      <span class="loader-label">No challenge set found</span>
    </div>
  {/if}
</div>
