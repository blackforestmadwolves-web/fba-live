"""Patch only a verified complete v131 deploy directory, never the stale repository root."""
from pathlib import Path
import sys,shutil
root=Path(sys.argv[1]);p=root/'index.html';s=p.read_text()
edits=[('<meta name="fba-build" content="season-consistency-v131-20260929">','<meta name="fba-build" content="podcast-v133-20260929">'),
 ('<script src="request-transport.js?v=130"></script>','<script src="request-transport.js?v=130"></script>\n<script src="podcast.js?v=133"></script>\n<link rel="stylesheet" href="podcast.css?v=133">'),
 ('["ueber","Start",pgOverview],','["ueber","Start",pgOverview],\n  ["podcast","Podcast",()=>window.FBA_PODCAST.markup()],'),
 ('let CUR = location.hash==="#draft-night"?"draftnight":"ueber";','let CUR = location.hash==="#podcast"?"podcast":location.hash==="#draft-night"?"draftnight":"ueber";')]
for before,after in edits:
 assert s.count(before)==1, 'Unexpected live frontend; refusing replacement'
 s=s.replace(before,after)
p.write_text(s)
for name in ['podcast.js','podcast.css']:shutil.copyfile(Path(__file__).parent/'web'/name,root/name)
print('Updated four exact frontend locations; existing assets preserved.')
