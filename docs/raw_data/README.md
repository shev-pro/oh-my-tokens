# Raw Data

This folder is the inbox for Lumen's ingestion pipeline.
Drop files here and run `/lumen ingest` to process them into structured documentation.

**Contents are not committed to Git** — this is a local staging area.

## Subfolders

| Folder | What to put here |
|--------|-----------------|
| `transcripts/` | Meeting notes, call transcripts, audio-to-text outputs |
| `emails/` | Email threads, Slack exports, discussion dumps |
| `screenshots/` | UI screenshots, architecture diagrams, whiteboard photos |
| `documents/` | Specs, RFCs, external docs, PDFs, any reference material |

## How it works

1. Drop your files into the appropriate subfolder
2. Run `/lumen ingest`
3. Lumen reads each file, extracts relevant knowledge, and routes it to the right
   document in `docs/`
4. A summary tells you what was extracted and where it went
