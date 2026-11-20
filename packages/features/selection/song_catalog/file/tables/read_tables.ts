// `data/`の表を読んで解釈する。

import {
  readAnotherSwitchesText,
  readMovieAliasesText,
  readSharedAssetsText,
} from "../catalog_gateway.ts";
import { parseAnotherSwitches } from "./another_switches.ts";
import { parseMovieAliases } from "./movie_aliases.ts";
import { parseSharedAssets } from "./shared_assets.ts";

export const readAnotherSwitches = (): ReturnType<
  typeof parseAnotherSwitches
> => parseAnotherSwitches(readAnotherSwitchesText());

export const readMovieAliases = (): ReturnType<typeof parseMovieAliases> =>
  parseMovieAliases(readMovieAliasesText());

export const readSharedAssets = (): ReturnType<typeof parseSharedAssets> =>
  parseSharedAssets(readSharedAssetsText());
