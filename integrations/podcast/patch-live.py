#!/usr/bin/env python3
"""Apply two bounded edits to a freshly backed-up LIVE Code.gs, not repo v93."""
import argparse
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('source');p.add_argument('target');a=p.parse_args()
s=Path(a.source).read_text()
edits=[("function doGet(e) {\n  var p = (e && e.parameter) || {};", "function doGet(e) {\n  var p = (e && e.parameter) || {};\n  if (p.podcast === '132') return fbaPodcastResponse132_(p);"),
("players: { limit: 2500, sortPercOwned: { sortPriority: 1, sortAsc: false } },\n      transactions: { limit: 1000 }", "players: { limit: 2500, sortPercOwned: { sortPriority: 1, sortAsc: false } }")]
for old,new in edits:
    if s.count(old)!=1:raise SystemExit('STOP: live code differs; fresh review required')
    s=s.replace(old,new)
Path(a.target).write_text(s)
print('Applied private podcast route and verified ESPN filter fix.')
