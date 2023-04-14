// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

import { writable } from 'svelte/store';
import type { Header, ChallengeData, ChallengeSet } from './CustomTypes';

export interface TooltipStoreValue {
  show: boolean;
  html: string;
  left: number;
  top: number;
  width: number;
  maxWidth: number;
  fontSize: string;
  tryHeight: boolean;
  /** 's' for south and 'n' for north */
  orientation: string;
}

export interface ChallengeStoreValue {
  selectedFileName: string;
  fileNames: Set<string>;
  selectedTypes: Set<string>;
  header?: Header;
  challengeData?: ChallengeData;
  challengeSet?: ChallengeSet;
}

export interface TimelineStoreValue {
  // Currently selected dates in string format 'YYYYMMDD'
  selectedDates: string[];
  allDates: Date[];
  dateFormatter: ((d: Date) => string) | null;
}

export interface EmbeddingSettingStoreValue {
  sampleMin: number;
  sampleMax: number;
  curSample: number;
  curSampleMethod: string;
  filteredIndexes: number[];
  showLogContour: boolean;
  showLogSample: boolean;
  showTrainSample: boolean;
}

export const getChallengeStoreDefaultValue = (): ChallengeStoreValue => {
  return {
    selectedFileName: '',
    fileNames: new Set(),
    // selectedTypes: new Set(['test']),
    selectedTypes: new Set(['test', 'topic'])
  };
};

export const getTooltipStoreDefaultValue = (): TooltipStoreValue => {
  return {
    show: false,
    html: 'null',
    left: 0,
    top: 0,
    width: 0,
    maxWidth: 400,
    fontSize: '13px',
    tryHeight: false,
    orientation: 's'
  };
};

export const getTimelineStoreDefaultValue = (): TimelineStoreValue => {
  return {
    selectedDates: [],
    allDates: [],
    dateFormatter: null
  };
};

export const getEmbeddingSettingStoreDefaultValue =
  (): EmbeddingSettingStoreValue => {
    return {
      sampleMin: 0,
      sampleMax: 1000,
      curSample: 200,
      curSampleMethod: 'unfamiliar',
      filteredIndexes: [],
      showLogContour: false,
      showLogSample: true,
      showTrainSample: true
    };
  };

export const getTooltipStore = () => {
  return writable(getTooltipStoreDefaultValue());
};

export const getChallengeStore = () => {
  return writable(getChallengeStoreDefaultValue());
};

export const getTimelineStore = () => {
  return writable(getTimelineStoreDefaultValue());
};

export const getEmbeddingSettingStore = () => {
  return writable(getEmbeddingSettingStoreDefaultValue());
};
