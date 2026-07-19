# etzhayyim-project-hospitality

`hospitality.etzhayyim.com` — Hotel / OTA / property umbrella project。ADR-0028 Phase 1 pilot。
chain / OTA / individual property を path-based actor DID で立て、各 actor が
`com.etzhayyim.apps.resourceFlow.legalEntity{Currency|Personnel|Service}Flow` を発行する。
`resource-flow.etzhayyim.com` が Follow で集約し sankey / lineage / comparison を可視化。

## Identity

| Field | Value |
|---|---|
| Domain | `hospitality.etzhayyim.com` |
| Role | Resource-flow emitter (ADR-0028) + hotel actor roster |
| Primary DID | `did:web:hospitality.etzhayyim.com` |
| Sensitivity | public (individual PII は ADR-0018 tier 3, cohort_size ≥ 5) |

## Responsibility Split (yadoya / minpaku / hospitality)

| Project | Responsibility | 実装状態 |
|---|---|---|
| `yadoya.etzhayyim.com` | Booking engine + MCP AI Agent + B2C/B2B UI + 予約ライフサイクル + ADR-0028 resource-flow emission | Bootstrap 2026-04-28 (worker/, ADR-0036 Worker-direct, 6 NSID + 4 BPMN). ADR-0074 aligned: every yadoya/RF vertex has `root_did` / `facade_did` / `migration_status` columns; sankey MV keys on `COALESCE(root_did, source_did)`. ERC725 root contract deployment is owned by the auth team — `migration_status="facade-only"` until backfill runs `migrate-rw-erc725-root.mjs --did did:web:yadoya.etzhayyim.com`. Legacy SpinApp `b7r4n2xq` retired to `_archive/`. |
| `minpaku.etzhayyim.com` | OSM Overpass + 観光庁 open data 2 次収集 (10 JP 都市) | LIVE (mp7k9x2w) |
| `hospitality.etzhayyim.com` | **chain / OTA / property actor roster** + revenue / headcount / room-nights flow 発行 | Scaffold (本 project) |

責務が重ならないよう、**hospitality は新規 booking / catalog を持たない**。既存の yadoya catalog / minpaku OSM から actor を昇格させ、flow record 発行に専念する。

## Actor Composition (Multi-DID)

```
did:web:hospitality.etzhayyim.com                                    (controller)

# ── Chain (ISIC I5510 — Hotels and similar accommodation) ──
did:web:hospitality.etzhayyim.com:actor:chain:marriott
did:web:hospitality.etzhayyim.com:actor:chain:hilton
did:web:hospitality.etzhayyim.com:actor:chain:hyatt
did:web:hospitality.etzhayyim.com:actor:chain:ihg
did:web:hospitality.etzhayyim.com:actor:chain:accor
did:web:hospitality.etzhayyim.com:actor:chain:wyndham
did:web:hospitality.etzhayyim.com:actor:chain:choice
did:web:hospitality.etzhayyim.com:actor:chain:hoshino           # 星野リゾート
did:web:hospitality.etzhayyim.com:actor:chain:prince            # プリンスホテル
did:web:hospitality.etzhayyim.com:actor:chain:tokyu-stay
did:web:hospitality.etzhayyim.com:actor:chain:apa
did:web:hospitality.etzhayyim.com:actor:chain:route-inn

# ── OTA (ISIC N7911 — Travel agency activities) ──
did:web:hospitality.etzhayyim.com:actor:ota:booking             # Booking.com
did:web:hospitality.etzhayyim.com:actor:ota:expedia
did:web:hospitality.etzhayyim.com:actor:ota:agoda
did:web:hospitality.etzhayyim.com:actor:ota:airbnb
did:web:hospitality.etzhayyim.com:actor:ota:rakuten-travel      # 楽天トラベル
did:web:hospitality.etzhayyim.com:actor:ota:jalan               # じゃらん
did:web:hospitality.etzhayyim.com:actor:ota:ikyu                # 一休.com
did:web:hospitality.etzhayyim.com:actor:ota:trip-com

# ── Industry association ──
did:web:hospitality.etzhayyim.com:actor:assoc:unwto             # UN World Tourism Organization
did:web:hospitality.etzhayyim.com:actor:assoc:jnto              # Japan National Tourism Organization
did:web:hospitality.etzhayyim.com:actor:assoc:str-global        # STR (industry benchmark)

# ── Individual property (minpaku 昇格) ──
did:web:hospitality.etzhayyim.com:actor:property:{osm-id}       # OSM node / way id
```

## Global Coverage Expansion (Reverse Toposort)

ADR-0028 Phase 1 の actor roster を全世界に拡張する。rollout 順序は **reverse topological sort**:
R0 coverage (flow observer, 完成判定) は `resource-flow` 既存 → R1 regional assoc (authority / benchmark) →
B2 regional OTA (demand aggregator) → R3 regional chain (supply operator) → R4 individual property (leaves)。
この順で downstream の collection contract を先に fix し、upstream 収集対象を後でぶらさない。

各 actor は `vertex_actor_profile_meta` (migration 0006) に profile meta を書き込み、
`vertex_legal_entity` (legal-entity platform) と `edge_same_as` で接続する (ADR-0019 bridging)。

### R1: Regional Industry Association (authority + benchmark)

| Region | DID | ISIC | Coverage basis |
|---|---|---|---|
| Global | `:actor:assoc:unwto` | N7990 | UNWTO Tourism Barometer (CC-BY-4.0) |
| Global | `:actor:assoc:str-global` | N7990 | STR benchmark (subscription, aggregate のみ) |
| Global | `:actor:assoc:hotstats` | N7990 | HotStats P&L benchmark |
| Europe | `:actor:assoc:hotrec` | N7990 | HOTREC (EU hotel association) |
| Europe | `:actor:assoc:eurostat-tourism` | N7990 | Eurostat Tourism (open) |
| MENA | `:actor:assoc:atm-dubai` | N7990 | Arabian Travel Market |
| MENA | `:actor:assoc:gcc-tourism` | N7990 | GCC Tourism Ministers Committee |
| APAC | `:actor:assoc:pata` | N7990 | Pacific Asia Travel Association |
| APAC | `:actor:assoc:asean-tourism` | N7990 | ASEAN Tourism Forum |
| APAC | `:actor:assoc:jnto` | N7990 | Japan National Tourism Organization |
| APAC | `:actor:assoc:knto` | N7990 | Korea Tourism Organization |
| APAC | `:actor:assoc:cnta` | N7990 | China National Tourism Administration |
| LATAM | `:actor:assoc:wttc-latam` | N7990 | WTTC Latin America chapter |
| LATAM | `:actor:assoc:copetur` | N7990 | Confederación Panamericana de Agencias de Viajes y Turismo |
| Africa | `:actor:assoc:africa-tourism` | N7990 | Africa Tourism Association |
| Africa | `:actor:assoc:rwanda-rdb` | N7990 | Rwanda Development Board (benchmark) |

### B2: Regional OTA (ISIC N7911)

| Region | DID | Notes |
|---|---|---|
| Global | `:actor:ota:booking`, `:ota:expedia`, `:ota:agoda`, `:ota:airbnb`, `:ota:trip-com` | (既存) |
| Europe | `:actor:ota:hrs` | HRS (DE, corporate travel) |
| Europe | `:actor:ota:lastminute` | lastminute.com group (CH/EU) |
| Europe | `:actor:ota:odigeo` | eDreams ODIGEO (ES/EU flight+hotel) |
| MENA | `:actor:ota:almosafer` | Almosafer (SA, Seera Group) |
| MENA | `:actor:ota:wego` | Wego (AE) |
| MENA | `:actor:ota:yatra-mena` | Yatra MENA |
| APAC | `:actor:ota:rakuten-travel`, `:ota:jalan`, `:ota:ikyu` | (既存, JP) |
| APAC | `:actor:ota:yanolja` | Yanolja (KR) |
| APAC | `:actor:ota:trip-com-jp` | (既存 global の subsidiary, optional) |
| APAC | `:actor:ota:makemytrip` | MakeMyTrip (IN) |
| APAC | `:actor:ota:goibibo` | Goibibo (IN, MMT group) |
| APAC | `:actor:ota:traveloka` | Traveloka (ID) |
| APAC | `:actor:ota:tiket-com` | tiket.com (ID) |
| APAC | `:actor:ota:klook` | Klook (HK, experiences+stays) |
| APAC | `:actor:ota:qunar` | Qunar (CN, Trip.com group) |
| APAC | `:actor:ota:fliggy` | Fliggy (CN, Alibaba) |
| LATAM | `:actor:ota:despegar` | Despegar (AR, LATAM leader) |
| LATAM | `:actor:ota:decolar` | Decolar (BR, Despegar brand) |
| LATAM | `:actor:ota:hotelurbano` | Hotel Urbano (BR) |
| Africa | `:actor:ota:jumia-travel` | Jumia Travel (pan-Africa, now partner-led) |
| Africa | `:actor:ota:travelstart` | Travelstart (ZA) |
| Africa | `:actor:ota:wakanow` | Wakanow (NG) |

### R3: Regional Chain (ISIC I5510)

| Region | DID | Notes |
|---|---|---|
| US | `:actor:chain:marriott`, `:chain:hilton`, `:chain:hyatt`, `:chain:ihg`, `:chain:wyndham`, `:chain:choice` | (既存) |
| US/Global | `:actor:chain:accor` | (既存, HQ FR) |
| JP | `:actor:chain:hoshino`, `:chain:prince`, `:chain:tokyu-stay`, `:chain:apa`, `:chain:route-inn` | (既存) |
| Europe | `:actor:chain:melia` | Meliá Hotels International (ES) |
| Europe | `:actor:chain:nh-hotel` | NH Hotel Group (ES, Minor 子会社) |
| Europe | `:actor:chain:radisson` | Radisson Hotel Group (HQ Brussels) |
| Europe | `:actor:chain:scandic` | Scandic Hotels (SE) |
| Europe | `:actor:chain:whitbread-premier-inn` | Premier Inn (UK) |
| Europe | `:actor:chain:travelodge-uk` | Travelodge (UK) |
| Europe | `:actor:chain:lhg-ihg-euro` | (included via IHG) |
| MENA | `:actor:chain:jumeirah` | Jumeirah Group (AE, Dubai Holding) |
| MENA | `:actor:chain:rotana` | Rotana Hotels (AE) |
| MENA | `:actor:chain:emaar-hospitality` | Emaar Hospitality (AE) |
| MENA | `:actor:chain:kempinski` | Kempinski (CH-HQ, MENA-heavy) |
| APAC | `:actor:chain:shangri-la` | Shangri-La Group (HK) |
| APAC | `:actor:chain:mandarin-oriental` | Mandarin Oriental (HK) |
| APAC | `:actor:chain:peninsula` | The Peninsula / HSH (HK) |
| APAC | `:actor:chain:oyo` | OYO (IN, budget aggregator) |
| APAC | `:actor:chain:taj` | Taj Hotels / IHCL (IN) |
| APAC | `:actor:chain:lotte-hotel` | Lotte Hotels (KR) |
| APAC | `:actor:chain:huazhu` | H World / Huazhu Group (CN) |
| APAC | `:actor:chain:jinjiang` | Jin Jiang International (CN) |
| APAC | `:actor:chain:bthh` | BTG Homeinns (CN) |
| APAC | `:actor:chain:minor-hotels` | Minor Hotels (TH) |
| APAC | `:actor:chain:dusit` | Dusit International (TH) |
| APAC | `:actor:chain:okura-nikko` | Okura Nikko Hotels (JP) |
| APAC | `:actor:chain:hilton-grand-vac-jp` | (subset of Hilton, skip) |
| LATAM | `:actor:chain:posadas` | Grupo Posadas (MX) |
| LATAM | `:actor:chain:city-express` | City Express (MX, Marriott 買収) |
| LATAM | `:actor:chain:accor-latam` | (included via Accor) |
| LATAM | `:actor:chain:decameron` | Royal Decameron (CO/CR resort) |
| Africa | `:actor:chain:tsogo-sun` | Tsogo Sun Hotels (ZA) |
| Africa | `:actor:chain:sun-international` | Sun International (ZA) |
| Africa | `:actor:chain:mantis` | Mantis Collection (ZA, Accor) |
| Africa | `:actor:chain:serena` | Serena Hotels (KE/UG/RW/TZ) |
| Africa | `:actor:chain:azalai` | Azalaï Hotels (ML, 西アフリカ) |

### R4: Individual Property (leaves)

`minpaku` OSM node を昇格。**DID scheme**: `did:web:hospitality.etzhayyim.com:actor:property:osm:{city-slug}`
を city-level aggregator DID として立て、個別 OSM node は `edge_located_in` で吊るす
(`vertex_id = did:web:hospitality.etzhayyim.com:actor:property:osm:{city}` → `edge_located_in` → minpaku 由来
`vertex_accommodation.listing_id`)。per-OSM-node を independent DID 化すると R3 で作成した
actor_profile に fan-out が effective 10k+ になるため、city aggregator 止めとする。

初期 10 都市 (minpaku coverage と一致): tokyo / osaka / kyoto / fukuoka / sapporo / nagoya / yokohama / kobe / sendai / hiroshima。
グローバル展開 (bangkok / bali / paris / london / dubai / istanbul / rome / barcelona / mexico-city / rio) は
Phase 2 で追加。R3 chain の children は `edge_owned_by` で別途吊る (chain: Marriott → property: property:chain:marriott:tokyo-marunouchi …)。

### RisingWave 登録契約 (各 actor profile の graph 書込)

各 R1-R3 actor について、以下を 1 commit ごとに書き込む。reverse-toposort の R1 から順次。

```ts
// 1. Profile meta (vertex_actor_profile_meta, migration 0006)
await sdk.pds.dispatch({
  type: "com.atproto.repo.createRecord",
  did: "did:web:hospitality.etzhayyim.com:actor:chain:melia",
  collection: "app.bsky.actor.profile",
  record: {
    displayName: "Meliá Hotels International",
    description: "[AI Agent — unofficial] ES-HQ hospitality chain, ~340 hotels, ISIC I5510",
    avatar: "MI",
  },
});

// 2. LEI bridge (edge_same_as → vertex_legal_entity)
//    `legal-entity.etzhayyim.com` の LEI row と :SAME_AS 接続
//    (Phase 2 で automated mapping)
```

**RisingWave 既存インフラ**:
- `vertex_actor_profile_meta` — display_name / description / avatar_cid / banner_cid
- `vertex_profile_fragment` + `embedding` (migration 0039) — IVF vector search 対応
- `vertex_legal_entity` — LEI / registration_number / wikidata_qid (migration 0024)
- `mv_world_vertex_per_host` (migration 0025, 0038) — coverage live count

**Coverage 目標** (reverse-toposort 完成判定):
- R1: 16 association actor (global/europe/mena/apac/latam/africa 分散)
- B2: 20+ OTA (region balanced)
- R3: 40+ chain (US/JP 既存 + EU 7 + MENA 4 + APAC 12 + LATAM 4 + AFR 5)
- R4: minpaku OSM からの property 昇格は Phase 2

### Expansion Iteration Log

| Iter | Date | Scope | Added |
|---|---|---|---|
| 0 | 2026-04-15 | ADR-0028 + 既存 US/JP roster | chain 12 + ota 8 + assoc 3 |
| 1 | 2026-04-15 (10min loop) | Global Coverage Expansion (EU/MENA/APAC/LATAM/AFR) | assoc +13 / ota +17 / chain +27 (roster only) |
| 2 | 2026-04-15 (10min loop) | `data/actor-roster.jsonl` SSoT + region gaps (CIS/CEE/SouthAsia/Oceania/Caribbean) | jsonl 115 total (R1=24, B2=36, R3=55). CIS assoc+ota+chain, CEE assoc+ota+chain, South Asia assoc+ota+chain, Oceania assoc+ota+chain, Caribbean assoc+ota+chain |
| 3 | 2026-04-15 (10min loop) | R3 JP/EU/MENA/APAC gap fill + R4 property DID 10 都市 + `scripts/sync-roster.ts` stub | jsonl 158 total (R1=24, B2=36, R3=88, R4=10). JP +7 (JR East / Daiwa Roynet / Nishitetsu / Fujita / Kyoritsu / Onyado-Nono / Mitsui Garden), EU +6 (Louvre / Warwick / Corinthia / Okko / H-Hotels / Maritim), MENA +4 (Millennium / Al Habtoor / HMH / Mövenpick), APAC SG/HK/TH/TW +9 (Ascott / Far East / Banyan / Centara / Pan Pacific / Langham / Hanjin KAL / Formosa / Leofoo), LATAM +3 (BR Hotels / Atton / Estelar), AFR +4 (City Lodge / Minor Africa / Onomo / Peermont), R4 property: tokyo/osaka/kyoto/fukuoka/sapporo/nagoya/yokohama/kobe/sendai/hiroshima |
| 4 | 2026-04-15 (10min loop) | `leiBridge.json` lexicon + Central Asia / 追加 AFR+CEE+South Asia + Global city R4 +10 | jsonl 191 total (R1=31, B2=42, R3=98, R4=20). Central Asia +6 (Kazakh Tourism / Uzbekistan Tourism / Aviata / MyTrip.az / Rixos / Asia Hotels KZ), AFR +8 (SAT / Egypt Tourism / Morocco ONT / SafariNow / NightsBridge / Pharaoh / Steigenberger Egypt / Lagoon), CEE +4 (Trivago / Enuygun / Orbis PL / Mamaison), South Asia +2 (Incredible India / SLTDA), Caribbean +3 (Couples / Palace / Meliá Caribbean), R4 global city +10 (bangkok/bali/paris/london/dubai/istanbul/rome/barcelona/mexico-city/rio). Lexicon: `com.etzhayyim.apps.hospitality.leiBridge` |
| 5 | 2026-04-15 (10min loop) | US chain depth + CN subbrand + South Asia + `ownedBy.json` lexicon + ownership-edges seed + test fixture | jsonl 219 total (R1=31, B2=42, R3=126, R4=20). US +8 (Best Western / Red Roof / La Quinta / Extended Stay / G6-Motel6 / Drury / Four Seasons / Loews), CN +7 (HanTing / All Seasons / Joya / Orange / 7 Days Inn / Plateno / 锦江之星), South Asia +4 (ITC / Oberoi / Leela / Jetwing), CIS +2 (Alrosa / HELIOPARK), Oceania NZ +2 (Heritage NZ / Millennium NZ), EU +2 (Dalata / Pandox), MENA +1 (Savoy Sharm), Caribbean +2 (Blue Diamond / Excellence). Lexicon: `com.etzhayyim.apps.hospitality.ownedBy` (chain→property親子 6 relationship). `ownership-edges.jsonl` seed with 20 parent/child links (Huazhu subbrands, Jin Jiang subbrands, Wyndham→LaQuinta, Marriott→CityExpress, Accor→Mövenpick/Mantis/Orbis/Rixos-jv, Booking→Agoda, Expedia→Trivago/Wotif, MMT→Goibibo, Minor→NH 0.94). Test fixture: `scripts/sync-roster.test-fixture.ts` validates reverse-topo order + dup-DID + LEI format |
| 6 | 2026-04-15 (10min loop) | Nordic + Baltic + West Africa + SE Asia + RisingWave migration 0057 coverage MV | jsonl 248 total (R1=41, B2=48, R3=139, R4=20). Nordic +5 (Visit Iceland/Finland/Norway / Momondo / Etraveli / Icelandair Hotels / Strawberry / Elite SE), Baltic +5 (Visit EE/LV/LT / Novaturas / Tallink / Radisson Baltic), AFR 西 +5 (Senegal Tourism / Ghana Tourism Authority / Teranga SN / Labadi Beach GH / Mangalis CI), SE Asia +5 (VNAT / PH DoT / Saigontourist / Muong Thanh / BlueWave / Robinsons / Yoma MM / Vntrip / iVivu / Hotels.ng). **Migration 0057** `mv_hospitality_actor_coverage` — narrow streaming MV (kind × COUNT) over `vertex_actor_profile_meta` WHERE hospitality path prefix. Pre-flight: cardinality 4 kinds, backfill 248 rows, no MAX(varchar) — MV safety OK |
| 7 | 2026-04-15 (10min loop) | TR/GR chain + KSA Vision 2030 + LATAM 深掘り + East Africa safari + Pacific Islands | jsonl 281 total (R1=49, B2=53, R3=159, R4=20). EU +7 (GNTO GR / Go Türkiye / Mitsis / Grecotel / TUI Hotels / RIU / Barceló / Dedeman TR / Travellink), MENA +7 (STA SA / NEOM Authority / Dur Hospitality / Sindalah NEOM / Red Sea Global / Rehlat OTA), East AFR +5 (KTB / TTB / Safari Collection KE / Wilderness Safaris BW / andBeyond / Singita TZ / HotelsCombined ZA), LATAM +5 (Enjoy CL / Inkaterra PE / Belmond LVMH / Libertador PE / Atrápalo OTA), Pacific +6 (Tourism Fiji / Tahiti Tourisme / Flight Centre / Outrigger / Aquila / Warwick Fiji). Coverage: europe 28, mena 20, africa 35, oceania 17 |
| 8 | 2026-04-15 (10min loop) | CEE 深掘り + BR chain + KR chain + PH conglomerate + ownership edges +6 + IVF embedding contract | jsonl 309 total (R1=52, B2=54, R3=183, R4=20). CEE +8 (POT PL / MTÜ HU / CzechTourism / Travelplanet PL / Arche / Danubius / Continental RO / CPI Hotels), BR +5 (Aimbre / Nobile / Bourbon / Transamerica / Windsor), KR +4 (Paradise / Walker Hill / Shilla / Ramada KR), PH +4 (Shangri-La Mactan / Ayala / SMDC / Discovery), JP 温泉 +2 (Nikko Kinugawa / Kato Kanko), AFR +2 (Protea / Legacy), Caribbean +2 (SuperClubs / Apple Leisure Group), Nordic +1 (Scandic Go). **Ownership edges +6**: Huazhu→Steigenberger EG (2019), TUI→RIU 0.49 jv, Marriott→Protea (2014), Scandic→Scandic Go subbrand, Jin Jiang→Radisson (2018), Hyatt→Apple Leisure (2021). **IVF embedding contract** for `vertex_profile_fragment`: nlist=16 (log-scale to 308 actors), 384-dim, hospitality-scoped, hybrid vector+region/tier search |
| 9 | 2026-04-15 (10min loop) | Alpine/Desert/Greater Bay luxury + casino-integrated resort (US gaming global) + ownership +6 + resource-flow subscribe wiring | jsonl 336 total (R1=56, B2=56, R3=204, R4=20). EU +8 (Swiss Tourism / Austria Werbung / Victoria-Jungfrau / Matterhorn / Tschuggen / Austria Trend / Falkensteiner), LATAM +5 (SERNATUR CL / PROMPERÚ / OYO MX / Tierra Hotels / Explora), APAC HK Greater Bay +8 (Sino / Wharf / New World / Rosewood / Regent / Aman / Six Senses / Alila / OYO Indonesia), MENA +1 (Qasr Al Sarab desert Anantara), AFR +1 (Wilderness Namibia desert), Oceania +1 (Quest Apartment), Global 統合型 resort +3 (MGM Resorts / Las Vegas Sands / Wynn Resorts — Macau/Singapore/Japan IR exposure). **Ownership edges +6**: New World→Rosewood, IHG→Regent (2018) + IHG→Six Senses (2019), Hyatt→Alila subbrand, Minor→Qasr Al Sarab manage, Ascott→Quest own. **resource-flow subscribeRepos wiring** — `hospitality.leiBridge` + `hospitality.ownedBy` + `app.bsky.actor.profile` を受信 (MV `mv_hospitality_actor_coverage` を commit 単位で再計算) |
| 10 | 2026-04-15 (10min loop) | Caribbean all-inclusive (AMResorts 6 subbrand) + JP 旅館 9 軒 + KSA giga (Diriyah/Amaala/Trojena/THE LINE/Oxagon) + migration 0060 ownership depth MV | jsonl 360 total (R1=57, B2=56, R3=227, R4=20). Caribbean +9 (Iberostar / Secrets / Dreams / Breathless / Zoetry / Sunscape / Now / Karisma / Club Med), JP 旅館 +10 (加賀屋 / あさば / 俵屋 / 柊家 / べにや無何有 / 山河黒川 / 強羅花壇 / 倉敷旅館 / 柳生の庄 / 箱根小涌園), MENA KSA giga +5 (Diriyah Company R1 / Amaala / Trojena / THE LINE Hospitality / Oxagon). **Ownership edges +12**: ALG→6 AMResorts subbrand, RedSeaGlobal→Amaala, NEOM Authority→{Trojena, Sindalah, THE LINE, Oxagon} own, 藤田観光→箱根小涌園 subbrand. **Migration 0060** `mv_hospitality_ownership_depth` — per-parent COUNT(direct_children) + last_seq, source `edge_owned_by WHERE src hospitality:%`. Parent cardinality ≤ 20 → MV safe |
| 11 | 2026-04-15 (10min loop) | Cruise kind 導入 (hospitality-at-sea) + US luxury independent + PT/UK boutique luxury + Nordic subbrand + direct-insert fallback SQL | jsonl 382 total (R1=57, B2=58, R3=247, R4=20). **新 kind `:actor:cruise:*`** (ISIC I5510 boundary decision: lodging-at-sea を hospitality として扱う): Royal Caribbean / Carnival / Norwegian / MSC / Viking / Genting Dream. US luxury +5 (Montage / Auberge / 1 Hotels / SBE / Graduate Hotels). EU luxury +5 (Pestana PT / Vila Vita / Oetker Collection DE / Dorchester Brunei / Firmdale UK / Rocco Forte), APAC +1 (Capella SG Pontiac Land), Nordic +2 (Clarion subbrand / Thon NO), OTA +2 (HotelsCombined FI / Helloworld AU). **Ownership edges +3**: Accor→SBE 0.5 (2018), Hilton→Graduate Hotels (2024), Strawberry→Clarion subbrand. **`direct-insert-fallback.sql`** — PDS/firehose 障害時に roster を直接 `vertex_actor_profile_meta` + `edge_same_as` に INSERT する DR 用 SQL (`ON CONFLICT DO NOTHING` idempotent, owner_did=controller固定, sensitivity_ord=0 public) |
| 12 | 2026-04-15 (10min loop) | Central Asia +5 / South Pacific +4 / Caribbean 国別 +9 / JP 国民宿舎系 +3 + `etzhayyim hospitality coverage` CLI | jsonl 406 total (R1=68, B2=59, R3=259, R4=20). Central Asia +5 (Kyrgyz/Tajikistan/Turkmenistan Tourism / Continental UZ / Silk Road CA), South Pacific +4 (Tonga/Samoa/Vanuatu/Cook Islands Tourism / Tanoa FJ / Aggie Grey's WS), Caribbean +9 (Mintur CU / Mitur DO / Discover PR / Bahamas Tourism / Gran Caribe CU / Cubanacán / Paradisus DR / Viva Wyndham / Condado PR / Vacations To Go OTA), JP +3 (国民宿舎 Federation / 民宿 Federation / 全国旅館ホテル生活衛生同業組合). **CLI** `70-tools/etzhayyim/etzhayyim/coverage_hospitality.go` — reads `mv_hospitality_actor_coverage` + `mv_hospitality_ownership_depth` via `db.RawQuery()` (Hyperdrive direct per 70-tools/CLAUDE.md read-path convention), `--format json\|table`, `--top-parents N`. Helpers: `parseIntLike()` + `fmt.Sprint()` (既存 oil-coverage decoder pattern と同一) |
| 13 | 2026-04-15 (10min loop) | 北アフリカ +6 / 中米 +6 / **indian-ocean 新 region +9** / PNG+NC +4 + `etzhayyim coverage hospitality` subcommand wire | jsonl 430 total (R1=78, B2=59, R3=273, R4=20). 北アフリカ +6 (Algeria ONT / Tunisia ONTT / Accor Maghreb / Atlas MA / Mövenpick TN), 中米 +6 (ICT CR / ATP PA / INGUAT GT / Marriott CR / Occidental / Camino Real GT), **indian-ocean 新 region +9**: Maldives MMPRC / Seychelles STA / Mauritius MTPA (R1) + Universal MV / Soneva / Cheval Blanc Randheli LVMH / Sun Resorts MU / Constance / LUX* MU (R3), 南太平洋 +4 (PNG TPA / NC Tourism / Lamana PG / Le Méridien NC). **`etzhayyim coverage hospitality` subcommand** を `70-tools/etzhayyim/etzhayyim/main.go` の `case "coverage"` dispatch に追加 (`runHospitalityCoverage(context.Background(), subArgs[1:])` via `withOcelLog("etzhayyim.coverage.hospitality", ...)`)、`context` import 追加。これで `etzhayyim coverage hospitality --format json --top-parents 10` が動作する |
| 14 | 2026-04-15 (10min loop) | 中米残り +3 / 南米深掘り +5 / 東南アジア残り +3 / 追加アフリカ +3 + validation SQL sample | jsonl 455 total (R1=92, B2=59, R3=284, R4=20). LATAM 国別 R1 +8 (IHT HN / MITUR SV / INTUR NI / Uruguay Tourism / SENATUR PY / Mintur VE / Ministerio Turismo EC / Viceministerio BO), 東南アジア R1 +3 (Lao Tourism / Tourism Cambodia / Tourism Brunei), アフリカ R1 +3 (Madagascar ONTM / Cameroon MINTOUL / Côte d'Ivoire MTL), R3 +10 (Radisson UY / Hotel del Paraguay / Gran Meliá VE / Swissôtel EC / Casa Grande BO / Sokha KH / Sunway MY / Genting Malaysia / The Empire BN / Onomo CM / Relais des Plateaux MG). **Validation SQL samples** (CLAUDE.md 記載): COUNT hospitality DIDs / MV kind coverage / ownership depth top-20 / LEI bridge count。CLI と同型 query |
| 15 | 2026-04-15 (10min loop) | Caribbean 小島嶼 +10 / Pacific micro-state +7 / Guianas +2 / 追加 Caribbean chain +2 + saturation note | jsonl 476 total (R1=110, B2=59, R3=287, R4=20). Caribbean R1 +9 (Discover Dominica / SLTA LC / SVG VC / Antigua AG / Visit Barbados / Pure Grenada GD / St. Kitts KN / Aruba ATA / Curaçao CTB), Pacific micro-state R1 +7 (Nauru NR / Palau PVA / FSM / Marshall MH / Kiribati KI / Tuvalu TV / Niue NU), LATAM Guianas +2 (Guyana GTA / Suriname STSUR), R3 +3 (Elegant BB / Sandals Grenada / Palau Pacific). **R1 tourism board 総数 110** — 国連加盟国 193 のうち 57% をカバー (assoc 系統で)。**Saturation note**: R1 は UN 加盟国分カバー近く、R3 は独立 chain 追加は収穫逓減。次段階は (a) R4 property (city aggregator) の 深掘り、(b) `resource-flow` Worker 実装、(c) hospitality サブコマンドの実データ接続、のいずれか |
| 16 | 2026-04-15 (10min loop) | アフリカ R1 一括 +15 / Caucasus+Balkan+Central Asia R1 +10 / Himalaya+MENA R1 +5 + migration 0061 tier×kind MV | jsonl 506 total (R1=140, B2=59, R3=287, R4=20). Africa R1 +15 (Uganda UTB / Ethiopia / Zimbabwe ZTA / Zambia / Botswana BTO / Mozambique INATUR / Angola / Namibia NTB / DRC / Gabon / Benin / Togo / Malawi / Mauritania / Guinea), Europe Caucasus+Balkan R1 +8 (Moldova / Albania AKT / N Macedonia / Montenegro / Serbia TOS / Bosnia / Armenia / Georgia GNTA / Azerbaijan ATB), South Asia R1 +3 (Nepal NTB / Bhutan TCB / Maldives MOT), MENA R1 +3 (Jordan JTB / Lebanon / Oman MHT). **R1 tourism board 総数 140** — UN 193 の **72% カバー**。**Migration 0061** `mv_hospitality_tier_coverage` — tier × kind cross-tab MV (DID path prefix から tier 推論: assoc→R1 / ota→B2 / chain\|cruise→R3 / property→R4)。GROUP BY (tier, kind) → 20 buckets、backfill 506 rows、no MAX(varchar) → MV safe |
| 17 | 2026-04-15 (10min loop) | 残 UN 加盟国 R1 一括 +43 → UN 95% カバレッジ、CLI tier breakdown 追加 | jsonl 549 total (R1=183, B2=59, R3=287, R4=20). Africa 西+東+小国 R1 +21 (Burkina / Mali / Niger / Chad / CAR / South Sudan / Sudan / Eritrea / Djibouti / Somalia / Burundi / Lesotho / Eswatini / Comoros / São Tomé / Cape Verde / Gambia / Sierra Leone / Liberia / Equatorial Guinea / Congo-Brazzaville), MENA R1 +8 (Iraq / Iran / Syria / Yemen / Palestine / Qatar QTA / Bahrain BTEA / Kuwait), Europe microstate+Balkan+Belarus R1 +9 (Andorra / San Marino / Monaco / Liechtenstein / Luxembourg LFT / Cyprus CTO / Malta MTA / Belarus / Kosovo), APAC +2 (Mongolia / Timor-Leste), Oceania +1 (Solomon Islands), Caribbean +2 (Haiti MDT / Trinidad TDC). **R1 tourism board 総数 183 / UN 193 = 95% カバー**。**CLI tier breakdown**: `coverage_hospitality.go` に `queryHospitalityTierCoverage()` + `hospitalityTierRow` 追加、出力に `tier × kind × actor_cnt` テーブル (migration 0061 `mv_hospitality_tier_coverage` を読む) |
| 18 | 2026-04-15 (10min loop, 2 invocations merged) | 最終 UN closure + EU missing fill-in → UN 100% (non-member observer 含む) | jsonl 564 total (R1=198, B2=59, R3=287, R4=20). Caribbean +2 (Belize BTB / JTB Jamaica), Africa +1 (Libya), APAC +2 (Afghanistan / DPRK KITC), Europe R1 +10 (Vatican / Portugal Turismo / NBTC Holland / Visit Belgium / Tourism Ireland / Romania / Bulgaria / Slovenia STO / Croatia HTZ / Ukraine). **R1 tourism board 198 / UN 193 = 100%+ (VA observer 含む)**. **Saturation reached** — 以降の R1 追加は subnational DMO (州/県レベル) に進むか、他 kind に pivot。以下のいずれかへ進むことを推奨: (a) **sync-roster 本番実行** → PDS 経由で 564 actor を `vertex_actor_profile_meta` に投入、migrations 0057-0059 を apply、(b) `resource-flow` Worker の `handleCommit` に `legalEntity{Currency\|Personnel\|Service}Flow` + `hospitality.leiBridge` + `hospitality.ownedBy` 分岐を実装、(c) LEI lookup 自動化 (GLEIF API 経由で 283 R3 chain の LEI bulk fetch) |

## RisingWave Ingestion Contract

`data/actor-roster.jsonl` (JSON Lines) が actor profile SSoT。各行は以下の shape:

```json
{"tier":"R1|R2|R3|R4","region":"global|europe|mena|apac|latam|africa|us|jp|cis|cee|south-asia|oceania|caribbean","did":"did:web:hospitality.etzhayyim.com:actor:...","isic":"I5510|N7911|N7990","displayName":"...","description":"...","avatar":"XX","lei":"...optional","source":"sec-10k|jp-edinet|cnmv|..."}
```

### Ingestion path (jsonl → RisingWave)

```
data/actor-roster.jsonl
  │
  ├─(1) etzhayyim hospitality sync-roster  (後続 PR で実装)
  │      ├─ for each row:
  │      │   a. sdk.did.create(path, document)                  — ADR-0019 path-based DID
  │      │   b. sdk.pds.dispatch({ type: "com.atproto.repo.createRecord",
  │      │        did, collection: "app.bsky.actor.profile",
  │      │        record: { displayName, description, avatar } })
  │      │   c. if lei: sdk.pds.dispatch({ type: "com.atproto.repo.createRecord",
  │      │        collection: "com.etzhayyim.apps.hospitality.leiBridge",
  │      │        record: { actorDid: did, lei, legalEntityDid: `did:web:legal-entity.etzhayyim.com:lei:${lei}` } })
  │      └─ emit one firehose commit per row
  │
  └─(2) PDS firehose → graph-writer → RisingWave hummock tables
         ├─ vertex_actor_profile_meta   (migration 0006) ← app.bsky.actor.profile
         │    columns: vertex_id, display_name, description, avatar_cid, banner_cid
         ├─ vertex_profile_fragment     (migration 0039) ← description IVF embedding
         │    columns: vertex_id, text, embedding, embedding_norm, ivf_cluster_id
         ├─ edge_same_as                                  ← leiBridge → legal-entity.lei:*
         │    columns: edge_id, src_vid, dst_vid
         └─ mv_world_vertex_per_host   (migration 0025/0038) — coverage live count
```

### 検証 SQL (iteration 完成判定)

```sql
-- R1/R2/R3 actor が vertex_actor_profile_meta に昇格しているか
SELECT COUNT(*) FROM vertex_actor_profile_meta
WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:actor:%';
-- 目標: Iter 2 時点で 115 (jsonl 行数と一致)

-- Region balance (owner_did prefix で region を別出し予定, 暫定は description 文字列)
SELECT SUBSTRING(vertex_id FROM 'actor:([^:]+):') AS tier_slug, COUNT(*)
FROM vertex_actor_profile_meta
WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:%'
GROUP BY 1 ORDER BY 2 DESC;
-- 目標: chain 55, ota 36, assoc 24

-- LEI bridge (edge_same_as → vertex_legal_entity)
SELECT COUNT(*) FROM edge_same_as e
JOIN vertex_legal_entity le ON le.vertex_id = e.dst_vid
WHERE e.src_vid LIKE 'did:web:hospitality.etzhayyim.com:%'
  AND le.lei IS NOT NULL;
-- 目標: jsonl で lei 付与済の行数と一致 (Iter 2 時点で ~10)

-- Coverage snapshot (mv_world_vertex_per_host)
SELECT * FROM mv_world_vertex_per_host WHERE app_host = 'hospitality';
-- Phase 2 で legal-entity.etzhayyim.com と並んで行が増えること
```

**MV safety (graph-schema CLAUDE.md §MV Memory Safety Guardrails 準拠)**:
- GROUP BY cardinality = region × tier = 13 × 4 = 最大 52 buckets → `CREATE MATERIALIZED VIEW` 可
- Initial backfill = 現時点 115 行 → OOM リスク無
- Wide `MAX(varchar)` 未使用 (単純 COUNT) → guardrail OK

### Validation SQL Samples (run against Hyperdrive / RisingWave)

`etzhayyim coverage hospitality` が内部で発行する query と同型。手で確認する際に使う。

```sql
-- 1. Roster 総数 (jsonl 行数と一致すること)
SELECT COUNT(*) AS total
FROM vertex_actor_profile_meta
WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:actor:%';

-- 2. Kind 別 (MV): chain / ota / assoc / property / cruise
SELECT kind, actor_cnt FROM mv_hospitality_actor_coverage ORDER BY actor_cnt DESC;

-- 3. Parent → children depth (Accor / Huazhu / Jin Jiang / IHG / NEOM Authority 等)
SELECT parent_did, direct_children
FROM mv_hospitality_ownership_depth
ORDER BY direct_children DESC LIMIT 20;

-- 4. LEI bridge 完了数 (hospitality actor ↔ legal-entity vertex)
SELECT COUNT(*) AS bridges
FROM edge_same_as e
JOIN vertex_legal_entity le ON le.vertex_id = e.dst_vid
WHERE e.src_vid LIKE 'did:web:hospitality.etzhayyim.com:%'
  AND le.lei IS NOT NULL;

-- 5. Region prefix 別の actor 分布 (region は owner_did 側に無いため ad-hoc):
--    display_name / description で region 推定する場合は IVF vector search 推奨
--    (migration 0039 vertex_profile_fragment)。
```

### IVF Embedding Ingestion Contract (`vertex_profile_fragment`, migration 0039)

`vertex_actor_profile_meta.description` (各 actor の `displayName + description`) を `profile-fragment-embedder`
Worker が Murakumo LLM で 384-dim float vector に変換し、`vertex_profile_fragment` に書き込む。
IVF cluster 化された vector 列で **similarity search** + **region/tier filter** を組み合わせた
ハイブリッド検索が可能になる (例: "luxury safari in East Africa" → :actor:chain:{singita|andBeyond|safari-collection} を top-k 返却)。

```
vertex_actor_profile_meta (migration 0006)
  vertex_id = did:web:hospitality.etzhayyim.com:actor:chain:marriott
  display_name = "Marriott International"
  description = "[AI Agent — unofficial] US-HQ hospitality chain, ISIC I5510"
       ↓ profile-fragment-embedder Worker (cron trigger)
vertex_profile_fragment (migration 0039)
  vertex_id = {actor_did}:desc
  text = displayName + " " + description
  embedding = float[384]
  embedding_norm = L2 norm
  ivf_cluster_id = bigint (IVF centroid)
```

**Ingestion rule (ADR-0028 + MV safety guardrail)**:
- Embedder は `WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:actor:%'` でスキャン (hospitality-scoped)
- IVF `nlist = 16` (cardinality 308 actors で過大設定にしない、log scale)
- Rerun は 24h 差分のみ (`updated_at > now() - interval '24 hours'`)
- Vector search: `ORDER BY embedding <-> query_vec LIMIT k` + `WHERE vertex_id LIKE 'did:web:hospitality.etzhayyim.com:actor:{kind}:%'`
- **LLM 禁止事項**: `description` 生成時に実在組織の financial numbers / PII を捏造しない。displayName + ISIC code + region のみから短文生成

### Iteration cadence

cron `3-59/10 * * * *` (job `1901d69c`) が 10 分毎に `/loop` prompt を再実行する。各 iteration は reverse-toposort 内の欠けた region / tier を 1 batch 埋める。7 日で auto-expire。

**Registration**: path-based DID は `sdk.did.create(path, document)` で登録する (Multi-DID CRITICAL rule 準拠)。
chain / OTA actor は LEI を DID document に含め、`legal-entity.etzhayyim.com` の `vertex_legal_entity` と
`:SAME_AS` で接続する (ADR-0019 bridging)。

## Resource-Flow Emission (ADR-0028)

各 actor が定期 fiscal-period ごとに flow record を書き込む。PII invariant:

- `counterpartyDid` は legal-entity DID のみ (個人 DID 禁止)
- 個人顧客 cohort は `cohortId` + `cohortSize >= 5` 必須

### Currency flow (revenue / cost / investment)

```ts
await sdk.pds.dispatch({
  type: "com.atproto.repo.createRecord",
  did: "did:web:hospitality.etzhayyim.com:actor:chain:marriott",
  collection: "com.etzhayyim.apps.resourceFlow.legalEntityCurrencyFlow",
  record: {
    sourceDid: "did:web:hospitality.etzhayyim.com:actor:chain:marriott",
    fiscalPeriod: "2025-Q4",
    flowType: "revenue",
    amount: 6_340_000_000,
    currency: "USD",
    industryCode: "I5510",
    sourceUrl: "https://marriott.gcs-web.com/news-releases/...",
    sourceLicense: "public-disclosure-10Q",
    note: "FY2025 Q4 reported revenue (hotel operations)",
  },
});
```

### Personnel flow (headcount delta)

```ts
{
  sourceDid: "did:web:hospitality.etzhayyim.com:actor:chain:hoshino",
  fiscalPeriod: "2025-Q4",
  flowType: "hire",
  headcountDelta: 412,
  totalHeadcount: 5_840,
  industryCode: "I5510",
  sourceUrl: "https://www.hoshinoresorts.com/ir/...",
  sourceLicense: "public-disclosure-ir",
}
```

### Service flow (room-nights / guests)

```ts
{
  sourceDid: "did:web:hospitality.etzhayyim.com:actor:chain:prince",
  fiscalPeriod: "2025-Q4",
  serviceClass: "room_night",
  count: 1_820_000,
  unit: "room_nights",
  revenue: 48_500_000_000,
  revenueCurrency: "JPY",
  cohortId: "did:web:talent.etzhayyim.com:cohort:jpn-domestic-leisure",
  cohortSize: 1_240_000,
  industryCode: "I5510",
  sourceUrl: "https://www.princehotels.co.jp/ir/...",
  sourceLicense: "public-disclosure-ir",
}
```

## Data Sources (ToS-compliant)

| Source | License | Coverage |
|---|---|---|
| SEC EDGAR 10-K/10-Q | public | US-listed chains (Marriott / Hilton / Hyatt / IHG / Choice / Wyndham) |
| EDINET (JP 金融庁) | public | JP-listed chains (西武/東急/阪急阪神/JR 系/APA group via 適時開示) |
| STR Global | subscription (本 project は未購入、aggregate のみ参照) | industry benchmark |
| UNWTO Tourism Barometer | CC-BY-4.0 | 国別 arrivals / room-nights |
| 観光庁 宿泊旅行統計調査 | public | JP 月次 room-nights / ADR |
| OSM Overpass (minpaku 経由) | ODbL | individual property entity |

## Build & Deploy

Phase 1 scope = actor roster + flow emission stub。booking / catalog は持たない。

```bash
# Phase 1 (roster only)
cd 60-apps/etzhayyim-project-hospitality
# DID registration script: 後続 PR で追加
# etzhayyim hospitality register-actors  # → sdk.did.create() for each path DID

# Phase 2 (flow emission)
# - chain/OTA actor ごとに IR / SEC EDGAR / EDINET scheduled collector
# - Emit legalEntity{Currency|Personnel|Service}Flow
```

## Phase Roadmap

| Phase | Scope | Status |
|---|---|---|
| 0 | ADR-0028 + 3 lexicon + deps.toml roster | **DONE (2026-04-15)** |
| 1 | path-DID roster registration script + `/actors` XRPC | pending PR |
| 2 | IR / EDGAR / EDINET scheduled collector per actor | pending |
| 3 | resource-flow Worker onCommit handler で 3 NSID accept + sankey 可視化 | pending |
| 4 | 残り 9 class lexicon (goods / debt / energy / ...) | pending |

## References

- `90-docs/adr/0028-resource-flow-private-sector-extension.md` — 本 project の権威 ADR
- `90-docs/adr/0018-pii-tier3-cohort-first.md` — PII tier + k-anonymity
- `90-docs/adr/0019-atproto-native-identifier-topology.md` — path-based DID
- `60-apps/etzhayyim-project-resource-flow/CLAUDE.md` — flow 集約側
- `60-apps/etzhayyim-project-yadoya/README.md` — booking 側
- `60-apps/etzhayyim-project-minpaku/CLAUDE.md` — OSM collector
- `00-contracts/lexicons/com/etzhayyim/apps/resourceFlow/legalEntity{Currency,Personnel,Service}Flow.json`
