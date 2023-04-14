// For licensing see accompanying LICENSE file.
// Copyright (C) 2023 Apple Inc. All Rights Reserved.

export enum PlotType {
  Keyword = 'keyword',
  Chrf = 'chrf',
  SourceID = 'source id',
  Embedding = 'embedding',
  Familiarity = 'familiarity',
  UnitTest = 'unit test'
}

export enum FilterType {
  Date = 'date',
  Keyword = 'keyword',
  Embedding = 'embedding',
  Chrf = 'chrf',
  Familiarity = 'familiarity',
  SourceID = 'sourceID',
  OtherSet = 'otherSet',
  Search = 'search'
}

export interface FilterTag {
  type: FilterType;
  message: string;
}

export interface Filters {
  date: number[];
  keyword: number[];
  embedding: number[];
  chrf: number[];
  familiarity: number[];
  sourceID: number[];
  otherSet: number[];
  search: number[];
}

export interface IntersectionData {
  topics: { [key: string]: { [key: string]: number[] } };
  tests: { [key: string]: { [key: string]: number[] } };
}

export interface SourceIDBinData {
  displayName: string;
  count: number;
  id: string | null;
}

export interface IntersectionBinData {
  displayName: string;
  count: number;
  sampleIndexes: number[];
}

export enum HeaderKey {
  displayName = 'displayName',
  logCount = 'logCount',
  trainCount = 'trainCount',
  chrf = 'chrf',
  familiarity = 'familiarity',
  trainLogRatio = 'trainLogRatio'
}

export interface ChallengeSetMeta {
  challengeSets: ChallengeSet[];
}

export interface Header {
  displayName: string;
  key: HeaderKey;
}

export interface TranslateSentence {
  source: string;
  hyp: string;
  showHyp: boolean;
  highlightRange?: number[][];
  type?: string;
}

export interface Keyword {
  word: string;
  value: number;
  color?: string;
  color2?: string;
}

export interface SamplePoint {
  x: number;
  y: number;
  source: string;
  name: string;
  hyp?: string;
  isTrain?: boolean;
  index?: number;
}

export enum ChallengeSetType {
  Topic = 'topic',
  UnitTest = 'unit-test'
}

export interface ChallengeSet {
  fileName: string;
  displayName: string;
  count: number;
  logCount: number;
  trainCount: number;
  type: ChallengeSetType;
  chrf?: number;
  familiarity?: number;
  trainLogRatio?: number;
}

export interface ChallengeData {
  source: string[];
  hyp: string[];
  x: number[];
  y: number[];
  source_id: (string | null)[];
  date: number[];
  train: number[];
  chrf: (number | null)[];
  familiarity: (number | null)[];
  keywords: [string, number][];
}

export interface DailyData {
  umap: number[][];
  source: string[];
  sourceID: string[];
  rareScores: number[];
}

export interface Padding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface DateCount {
  date: Date;
  count: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Position of an object
 */
export interface Position {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GridMetaData {
  vmin: number;
  vmax: number;
  step: number;
}

export interface GridData {
  pdf: number;
  conf: number;
  chrf: number;
}

export interface LogGridJSONData {
  meta: GridMetaData;
  data: number[][];
}

export interface GridJSONData {
  meta: GridMetaData;
  data: GridData[][];
}
