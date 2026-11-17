# IIDX CS ARCHIVE

Makes one PS2 disc image with the songs of the PS2 IIDX series.

## Requirements

- A disc drive
- Discs from 3rd style to 16 Premium Best, and the USA version
- [FFmpeg](https://ffmpeg.org/)

## Usage

1. Download the zip from
   [Releases](https://github.com/progre/iidx-cs-archive/releases).
2. Unzip it.
3. Run `iidx-cs-archive.exe` in the unzipped folder.
4. Put in each disc when asked.

You get `build/iidx-cs-archive.iso`.

> [!IMPORTANT]
> The image needs the extended RAM of [PCSX2](https://pcsx2.net/).
> Turn it on before you play:
>
> 1. In PCSX2, check **Tools > Show Advanced Settings**.
> 2. Open the settings, and go to the **Advanced** page.
> 3. Check **Enable Extended RAM (Dev Console)**.

## Building from source

Requires [Deno](https://deno.com/) 2.

```sh
deno task build    # build the image
deno task compile  # build the Windows exe
```

## Acknowledgements

- [iidx-ps2tools](https://github.com/SaxxonPike/iidx-ps2tools)
  for the chart format
- [vgmstream](https://github.com/vgmstream/vgmstream)
  for the sound format
