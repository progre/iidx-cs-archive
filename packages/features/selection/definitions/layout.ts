import type {
  ArchiveRule,
  ArtworkLayout,
  ChartLayout,
  OverlayLayout,
  SelectionLayout,
  SongDbRecordLayout,
  TitleEncoding,
  TitleLayout,
  VideoLayout,
} from "@csa/core";
import {
  booleanOf,
  cellOf,
  numberOf,
  optionalNumberOf,
  optionalOf,
  type Row,
  singleSlotOf,
  sizedSlotsOf,
  slotsOf,
} from "./cells.ts";

const TITLE_ENCODINGS: string[] = [
  "euc-jp",
  "shift-jis",
] satisfies TitleEncoding[];

function isTitleEncoding(cell: string): cell is TitleEncoding {
  return TITLE_ENCODINGS.includes(cell);
}

function titleEncodingOf(row: Row): TitleEncoding | null {
  const cell = cellOf(row, "titleEncoding");
  if (cell === "") {
    return null;
  }
  if (!isTitleEncoding(cell)) {
    throw new Error(`${row.generation}のtitleEncodingが不明: ${cell}`);
  }
  return cell;
}

function titleOf(row: Row): TitleLayout {
  return {
    offset: numberOf(row, "titleOffset"),
    isElfPointer: booleanOf(row, "titleIsElfPointer"),
    fullOffset: optionalNumberOf(row, "fullTitleOffset"),
    encoding: titleEncodingOf(row),
    hasIndexPrefix: booleanOf(row, "titleHasIndexPrefix"),
  };
}

function selectionOf(row: Row): SelectionLayout {
  return {
    others: optionalOf(row, "others", singleSlotOf),
    bpm: optionalOf(row, "bpmMin", () => ({
      minOffset: numberOf(row, "bpmMinOffset"),
      maxOffset: numberOf(row, "bpmMaxOffset"),
      firstOffset: numberOf(row, "bpmFirstOffset"),
    })),
    beginnerLevelOffset: optionalNumberOf(row, "beginnerLevelOffset"),
    levels: slotsOf(row, "levels"),
    origin: optionalOf(row, "songOrigin", () => ({
      offset: numberOf(row, "songOriginOffset"),
      bytes: numberOf(row, "songOriginBytes"),
      isVersion: booleanOf(row, "songOriginIsVersion"),
    })),
  };
}

const ARCHIVE_RULES: string[] = [
  "origin",
  "overlap",
] satisfies ArchiveRule[];

function isArchiveRule(cell: string): cell is ArchiveRule {
  return ARCHIVE_RULES.includes(cell);
}

function archiveRuleOf(row: Row, column: string): ArchiveRule | null {
  const cell = cellOf(row, column);
  if (cell === "") {
    return null;
  }
  if (!isArchiveRule(cell)) {
    throw new Error(`${row.generation}の${column}が不明: ${cell}`);
  }
  return cell;
}

function videoOf(row: Row): VideoLayout {
  return {
    primary: sizedSlotsOf(row, "video1"),
    derivesSecondary: booleanOf(row, "derivesSecondVideo"),
    archiveRule: archiveRuleOf(row, "videoArchiveRule"),
    secondary: optionalOf(row, "video2", sizedSlotsOf),
    secondaryIsFallback: booleanOf(row, "video2IsFallback"),
    movieLeadOffset: optionalNumberOf(row, "movieLeadOffset"),
    unkPb62Offset: optionalNumberOf(row, "unkPb62Offset"),
    secondaryArchiveOffset: optionalNumberOf(row, "video2ArchiveOffset"),
    movieCountInOffset: optionalNumberOf(row, "movieCountInOffset"),
  };
}

function artworkOf(row: Row): ArtworkLayout {
  return {
    genreOffset: optionalNumberOf(row, "genreOffset"),
    bigTitleOffset: optionalNumberOf(row, "bigTitleOffset"),
    artistOffset: optionalNumberOf(row, "artistOffset"),
    titleCard: singleSlotOf(row, "titleCard"),
    titleCardPairs: optionalOf(row, "titleCardPairs", slotsOf),
    imageSet: optionalOf(row, "imageSet", slotsOf),
    unkPbBcOffset: optionalNumberOf(row, "unkPbBcOffset"),
  };
}

function chartOf(row: Row): ChartLayout {
  return {
    files: slotsOf(row, "charts"),
    areElfPointers: booleanOf(row, "chartsAreElfPointers"),
    sounds: slotsOf(row, "sounds"),
    anotherBgmOffset: optionalNumberOf(row, "anotherBgmOffset"),
    keysoundArchiveOffset: optionalNumberOf(row, "keysoundArchiveOffset"),
    notes: optionalOf(row, "notes", slotsOf),
    unkPb126: optionalOf(row, "unkPb126", slotsOf),
  };
}

function overlayOf(row: Row): OverlayLayout {
  return {
    packages: optionalOf(row, "overlayPackages", slotsOf),
    pairs: optionalOf(row, "overlayPairs", slotsOf),
    slots: optionalOf(row, "overlaySlots", sizedSlotsOf),
    fileOffset: optionalNumberOf(row, "overlayFileOffset"),
    archiveRule: archiveRuleOf(row, "overlayArchiveRule"),
  };
}

export function songDbRecordLayoutOf(row: Row): SongDbRecordLayout {
  return {
    title: titleOf(row),
    selection: selectionOf(row),
    video: videoOf(row),
    artwork: artworkOf(row),
    overlay: overlayOf(row),
    chart: chartOf(row),
  };
}
