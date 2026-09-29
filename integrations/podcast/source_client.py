#!/usr/bin/env python3
"""Fetch the private FBA source packet. No audio generation or publication.

FBA_APP_API_URL is the existing /exec URL; FBA_DEVICE_TOKEN is an already
authorized device token supplied by the production secret store, never in args.
"""
import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import tempfile
from urllib.parse import urlsplit, urlencode
from urllib.request import urlopen

def validate(packet):
    if packet.get('ok') is not True or packet.get('schema') != 132 or packet.get('scope') != 'private_podcast_sources':
        raise ValueError('Privater Podcast-Datenstand nicht verfügbar oder Gerät nicht freigeschaltet.')
    if packet.get('season') != 2027 or len(packet.get('teams', [])) != 8 or len(packet.get('matchups', [])) != 4:
        raise ValueError('Falsche Saison oder unvollständige Liga.')
    stamp=datetime.fromisoformat(packet['created_at'].replace('Z','+00:00'))
    age=(datetime.now(timezone.utc)-stamp).total_seconds()
    if not -60 <= age <= 5400 or packet.get('delivery',{}).get('stale') is not False:
        raise ValueError('Quellenstand veraltet; kein neuer Tagesbrief freigegeben.')
    return packet

def fetch():
    base=os.environ.get('FBA_APP_API_URL',''); token=os.environ.get('FBA_DEVICE_TOKEN','')
    url=urlsplit(base)
    if url.scheme!='https' or url.netloc!='script.google.com' or not url.path.endswith('/exec') or url.query or url.fragment:
        raise ValueError('Bestehende Google-Apps-Script-Web-App als FBA_APP_API_URL erforderlich.')
    if len(token)<40:raise ValueError('Vorhandener FBA-Gerätezugang fehlt in FBA_DEVICE_TOKEN.')
    # Existing App auth boundary. Never print request URLs or exception bodies.
    with urlopen(base+'?'+urlencode({'podcast':'132','token':token}),timeout=60) as r:
        raw=r.read(7_000_001)
    if len(raw)>7_000_000:raise ValueError('Quellenpaket zu groß.')
    return validate(json.loads(raw))

def save(packet,path):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    with tempfile.NamedTemporaryFile(mode='w',encoding='utf8',dir=path.parent,delete=False) as f:
        json.dump(packet,f,ensure_ascii=False);f.write('\n');name=f.name
    os.replace(name,path)

if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('output');a=p.parse_args()
    try:
        packet=fetch();save(packet,a.output)
        print(json.dumps({'saved':True,'as_of':packet['created_at'],'readiness':packet['readiness'],'limitations':packet['limitations']},ensure_ascii=False))
    except Exception:
        p.exit(1,'Abruf fehlgeschlagen. Zugang und aktuellen Quellenstatus im App-Backend prüfen.\n')
