#!/usr/bin/env python3
# =============================================================================
# dashboard.py -- ai-core-kit self-contained INTERACTIVE offline-cost dashboard
#                 (CHILD layer)
# =============================================================================
# Shipped into a forked project by `/ack-init` when telemetry.enabled: true.
# This is the SAME renderer as the kit's META telemetry/dashboard.py; like
# watch.py it subprocesses the sibling aggregate.py + dora.py that `/ack-init`
# installs next to it, so the child's pricing.json + ${CLAUDE_PROJECT_DIR} /
# project.manifest.yaml resolution (handled inside aggregate.py / dora.py) is
# inherited automatically -- nothing layer-specific lives here.
#
# WHAT THIS IS
#   A stdlib-only renderer that produces ONE self-contained .html file (or serves
#   it locally) with an interactive cost / tokens / DORA dashboard. It does NOT
#   re-implement pricing, attribution, or DORA math: it SUBPROCESSES the existing
#   engines that live beside it --
#       python3 aggregate.py --by feature,model,agent,session,day \
#                            --daily --daily-by model --format json
#       python3 dora.py --format json
#   -- embeds their JSON INLINE in the page, and ships inline <style> + inline
#   <script> that draw SVG charts, sort tables, and filter the daily series in
#   the browser. NO external CSS/JS/CDN, NO network, NO deps.
#
# WHY OFFLINE (the issue-11008 constraint)
#   Claude Code hooks receive NO token/cost fields, so a live token meter is
#   impossible (https://github.com/anthropics/claude-code/issues/11008, open).
#   ALL cost here is RECOMPUTED from transcript usage x pricing.json, after the
#   fact. The page says so, loudly, in a banner: "OFFLINE - recomputed at <ts>".
#   In --serve mode the engines are re-run on every request, which is the most
#   honest "live" view there can be (a zero-infra, Grafana-free Tier-0+ option).
#
# USAGE
#   python3 dashboard.py [--out cost-dashboard.html]
#                        [--since YYYY-MM-DD] [--until YYYY-MM-DD]
#                        [--pricing PATH] [--title TITLE]
#                        [--budget USD] [--budget-axis AXIS]
#                        [--serve] [--port 8787] [--watch SECONDS] [--once]
#
#   # write a single file (default):
#   python3 dashboard.py --out cost-dashboard.html
#   # local live dashboard, regenerated per request, auto-reload every 10s:
#   python3 dashboard.py --serve --port 8787 --watch 10
# =============================================================================

import argparse
import datetime as _dt
import json
import os
import subprocess
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
AGGREGATE = os.path.join(HERE, "aggregate.py")
DORA = os.path.join(HERE, "dora.py")

# The cross-sectional axes we ask aggregate.py for, plus the per-day time series.
DASHBOARD_AXES = "feature,model,agent,session,day"
DAILY_BY = "model"

ISSUE_URL = "https://github.com/anthropics/claude-code/issues/11008"


class DashboardError(Exception):
    """Fatal dashboard build error (engine failure, bad JSON, write error)."""


# ---------------------------------------------------------------------------
# data gathering -- shell out to the engines; never re-implement their math
# ---------------------------------------------------------------------------
def _run_json(cmd, what):
    """Run an engine and return its parsed JSON stdout, or raise DashboardError."""
    try:
        p = subprocess.run(cmd, capture_output=True, text=True)
    except OSError as e:  # pragma: no cover - launch failure
        raise DashboardError(f"failed to launch {what}: {e}")
    if p.returncode != 0:
        msg = (p.stderr or p.stdout or f"{what} exited {p.returncode}").strip()
        raise DashboardError(f"{what} failed (exit {p.returncode}):\n{msg}")
    try:
        return json.loads(p.stdout)
    except json.JSONDecodeError as e:
        raise DashboardError(f"{what} did not emit valid JSON: {e}")


def gather(args):
    """Run aggregate.py + dora.py and return the embedded-data payload dict."""
    agg_cmd = [
        sys.executable, AGGREGATE,
        "--by", DASHBOARD_AXES,
        "--daily", "--daily-by", DAILY_BY,
        "--format", "json",
    ]
    if args.since:
        agg_cmd += ["--since", args.since]
    if args.until:
        agg_cmd += ["--until", args.until]
    if args.pricing:
        agg_cmd += ["--pricing", args.pricing]
    if args.budget is not None:
        agg_cmd += ["--budget", str(args.budget), "--budget-axis", args.budget_axis]

    aggregate = _run_json(agg_cmd, "aggregate.py")

    # DORA is best-effort: a repo with no deploy history still renders a useful
    # cost/tokens dashboard, so a DORA failure degrades the Delivery tab only.
    dora = None
    dora_error = None
    try:
        dora = _run_json([sys.executable, DORA, "--format", "json"], "dora.py")
    except DashboardError as e:
        dora_error = str(e)

    return {
        "generated_at": _dt.datetime.now(_dt.timezone.utc)
        .isoformat(timespec="seconds"),
        "title": args.title,
        "since": args.since,
        "until": args.until,
        "issue_url": ISSUE_URL,
        "aggregate": aggregate,
        "dora": dora,
        "dora_error": dora_error,
    }


# ---------------------------------------------------------------------------
# HTML assembly -- inline <style>, inline <script>, inline JSON. No external refs.
# ---------------------------------------------------------------------------
def _esc(s):
    """Minimal HTML escape for text/attribute content."""
    return (str(s).replace("&", "&amp;").replace("<", "&lt;")
            .replace(">", "&gt;").replace('"', "&quot;"))


def _json_for_script(payload):
    """Serialize payload for safe inlining inside a <script> block.

    JSON `</script>` and HTML-comment openers are escaped so the embedded data
    can never terminate the script element or be mistaken for markup.
    ensure_ascii=True makes json.dumps escape every non-ASCII code point
    as a \\uXXXX sequence, which also neutralizes U+2028 / U+2029 (the JS
    line/paragraph separators that would otherwise break a <script> parse).
    """
    raw = json.dumps(payload, separators=(",", ":"), ensure_ascii=True)
    return raw.replace("</", "<\\/").replace("<!--", "<\\!--")


_STYLE = r"""
:root{
  color-scheme: light dark;
  --bg:#ffffff; --fg:#1b1b1b; --muted:#666; --line:#e3e3e3; --line2:#ededed;
  --card:#fafafa; --accent:#4c78a8; --accent2:#54a24b; --accent3:#e45756;
  --grid:#eaeaea; --ok-bg:#dafbe1; --ok-fg:#1a7f37; --bad-bg:#ffe3e0; --bad-fg:#b3261e;
  --warn:#bf8700; --tab:#f0f0f0; --tabactive:#fff;
}
@media (prefers-color-scheme: dark){
  :root{
    --bg:#161616; --fg:#e6e6e6; --muted:#9a9a9a; --line:#333; --line2:#2a2a2a;
    --card:#1f1f1f; --accent:#6ea0d8; --accent2:#7cc46f; --accent3:#f0837f;
    --grid:#2a2a2a; --ok-bg:#10301a; --ok-fg:#5fd07e; --bad-bg:#3a1715; --bad-fg:#ff9a92;
    --warn:#e3b341; --tab:#1f1f1f; --tabactive:#2a2a2a;
  }
}
*{box-sizing:border-box;}
body{font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  margin:0;padding:1.5rem 2rem 3rem;max-width:1100px;margin-inline:auto;color:var(--fg);background:var(--bg);}
h1{font-size:1.55rem;margin:0 0 .15rem;}
h2{font-size:1.1rem;margin:1.4rem 0 .5rem;border-bottom:1px solid var(--line);padding-bottom:.25rem;}
h3{font-size:.95rem;margin:1rem 0 .4rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;}
a{color:var(--accent);}
.banner{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.75rem 0 1rem;
  padding:.55rem .8rem;border:1px solid var(--warn);border-radius:8px;background:rgba(191,135,0,.08);font-size:.85rem;}
.banner .dot{width:.6rem;height:.6rem;border-radius:50%;background:var(--warn);display:inline-block;flex:none;}
.sub{color:var(--muted);margin:0 0 1rem;}
.cards{display:flex;flex-wrap:wrap;gap:.75rem;margin:1rem 0;}
.card{flex:1 1 150px;border:1px solid var(--line);border-radius:8px;padding:.6rem .8rem;background:var(--card);}
.card .k{color:var(--muted);font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;}
.card .v{font-size:1.25rem;font-weight:600;}
.tabs{display:flex;gap:.25rem;margin:1.25rem 0 .5rem;border-bottom:1px solid var(--line);}
.tab{appearance:none;border:1px solid var(--line);border-bottom:none;background:var(--tab);color:var(--fg);
  padding:.45rem .9rem;border-radius:8px 8px 0 0;cursor:pointer;font:inherit;font-weight:600;opacity:.7;}
.tab[aria-selected="true"]{background:var(--tabactive);opacity:1;margin-bottom:-1px;}
.panel{display:none;}
.panel.active{display:block;}
.controls{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center;margin:.5rem 0 1rem;}
.controls .seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.controls .seg button{appearance:none;border:none;background:transparent;color:var(--fg);
  padding:.35rem .8rem;cursor:pointer;font:inherit;}
.controls .seg button[aria-pressed="true"]{background:var(--accent);color:#fff;font-weight:600;}
.controls label{color:var(--muted);font-size:.8rem;}
table{border-collapse:collapse;width:100%;margin:.25rem 0 1rem;font-variant-numeric:tabular-nums;}
th,td{padding:.35rem .55rem;border-bottom:1px solid var(--line2);text-align:left;}
th{font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;color:var(--muted);}
th.sortable{cursor:pointer;user-select:none;white-space:nowrap;}
th.sortable:hover{color:var(--fg);}
th.sortable .arr{opacity:.4;font-size:.7em;}
th.sortable[aria-sort="descending"] .arr,th.sortable[aria-sort="ascending"] .arr{opacity:1;}
td.num,th.num{text-align:right;}
tr.sum td{border-top:2px solid var(--line);font-weight:600;}
.barcell{width:160px;}
.bar{height:12px;border-radius:2px;background:var(--accent);display:inline-block;vertical-align:middle;}
.bartrack{background:var(--line2);border-radius:2px;width:140px;display:inline-block;vertical-align:middle;height:12px;}
.badge{display:inline-block;padding:.05rem .5rem;border-radius:999px;font-size:.72rem;font-weight:600;}
.badge.ok{background:var(--ok-bg);color:var(--ok-fg);}
.badge.bad{background:var(--bad-bg);color:var(--bad-fg);}
.chart{margin:.5rem 0 1rem;}
.chart svg{max-width:100%;height:auto;display:block;}
.legend{display:flex;flex-wrap:wrap;gap:.75rem;font-size:.78rem;color:var(--muted);margin:.25rem 0 .5rem;}
.legend .sw{display:inline-block;width:.7rem;height:.7rem;border-radius:2px;margin-right:.3rem;vertical-align:middle;}
.gauge{display:flex;align-items:center;gap:.8rem;flex-wrap:wrap;margin:.5rem 0;}
.gtrack{flex:1 1 240px;height:16px;background:var(--line2);border-radius:999px;overflow:hidden;min-width:200px;}
.gfill{height:100%;background:var(--accent2);}
.gfill.warn{background:var(--warn);}
.gfill.over{background:var(--accent3);}
.dora-grid{display:flex;flex-wrap:wrap;gap:.75rem;}
.dora-grid .card{flex:1 1 200px;}
.rating{font-size:.72rem;text-transform:uppercase;letter-spacing:.03em;}
.rating.elite,.rating.high{color:var(--ok-fg);}
.rating.medium{color:var(--warn);}
.rating.low{color:var(--bad-fg);}
small,.muted{color:var(--muted);}
footer{margin-top:2rem;color:var(--muted);font-size:.8rem;border-top:1px solid var(--line);padding-top:.75rem;}
.err{border:1px solid var(--accent3);background:var(--bad-bg);color:var(--bad-fg);padding:.6rem .8rem;border-radius:8px;}
"""


# The interactive client. Pure DOM + inline SVG; no libraries. Reads the inlined
# global `DATA` (set just above this script) and renders/charts/sorts/filters.
_SCRIPT = r"""
(function(){
  "use strict";
  var D = window.__ACK_DATA__;
  var AGG = D.aggregate || {};
  var BUCKETS = AGG.buckets || {};
  var DAILY = (AGG.daily && AGG.daily.days) || [];
  var TOKEN_KINDS = ["input","output","cache_read","cache_write_5m","cache_write_1h"];
  var PALETTE = ["#4c78a8","#54a24b","#e45756","#f58518","#72b7b2","#b279a2",
                 "#ff9da6","#9d755d","#bab0ac","#eeca3b"];

  function $(sel,root){return (root||document).querySelector(sel);}
  function $all(sel,root){return Array.prototype.slice.call((root||document).querySelectorAll(sel));}
  function el(tag,attrs,kids){
    var n=document.createElement(tag);
    if(attrs)for(var k in attrs){if(k==="class")n.className=attrs[k];else if(k==="text")n.textContent=attrs[k];else n.setAttribute(k,attrs[k]);}
    (kids||[]).forEach(function(c){n.appendChild(typeof c==="string"?document.createTextNode(c):c);});
    return n;
  }
  function svgEl(tag,attrs){
    var n=document.createElementNS("http://www.w3.org/2000/svg",tag);
    if(attrs)for(var k in attrs)n.setAttribute(k,attrs[k]);
    return n;
  }
  function fmtUSD(n){return "$"+(Number(n)||0).toFixed(4);}
  function fmtUSD2(n){return "$"+(Number(n)||0).toFixed(2);}
  function tokSum(t){if(!t)return 0;var s=0;TOKEN_KINDS.forEach(function(k){s+=(t[k]||0);});return s;}
  function ioTok(t){return (t&&(t.input||0)+(t.output||0))||0;}
  function cacheTok(t){return t?((t.cache_read||0)+(t.cache_write_5m||0)+(t.cache_write_1h||0)):0;}
  function fmtInt(n){return (Number(n)||0).toLocaleString();}
  function fmtTokShort(n){n=Number(n)||0;if(n>=1e6)return (n/1e6).toFixed(1)+"M";if(n>=1e3)return (n/1e3).toFixed(1)+"k";return ""+Math.round(n);}

  // ----- tabs -----
  $all(".tab").forEach(function(btn){
    btn.addEventListener("click",function(){
      $all(".tab").forEach(function(b){b.setAttribute("aria-selected", b===btn?"true":"false");});
      $all(".panel").forEach(function(p){p.classList.toggle("active", p.id==="panel-"+btn.dataset.tab);});
    });
  });

  // ----- time-range filtering of the daily series -----
  var rangeDays = "all"; // "7","30","all"
  function filteredDaily(){
    if(rangeDays==="all"||!DAILY.length)return DAILY.slice();
    var n=parseInt(rangeDays,10);
    // The daily series is chronological; "undated" (non-date) buckets sort last.
    var dated=DAILY.filter(function(d){return /^\d{4}-\d{2}-\d{2}$/.test(d.day);});
    return dated.slice(Math.max(0,dated.length-n));
  }

  // ----- generic sortable table -----
  // rows: [{cells:[...display...], sort:{colIndex:value}}], with a footer row.
  function makeTable(headers, rows, footer){
    var table=el("table"); var thead=el("thead"); var htr=el("tr");
    headers.forEach(function(h,i){
      var th=el("th",{class:(h.num?"num ":"")+(h.sortKey!=null?"sortable":"")});
      th.appendChild(document.createTextNode(h.label));
      if(h.sortKey!=null){
        th.appendChild(el("span",{class:"arr",text:" ↕"}));
        th.dataset.col=i; th.dataset.sortkey=h.sortKey;
        th.setAttribute("role","button");
        th.addEventListener("click",function(){sortBy(i);});
      }
      htr.appendChild(th);
    });
    thead.appendChild(htr); table.appendChild(thead);
    var tbody=el("tbody"); table.appendChild(tbody);
    if(footer){var tf=el("tbody"); tf.className="foot"; table.appendChild(tf); table._foot=tf; table._footerRow=footer;}
    table._headers=headers; table._rows=rows; table._tbody=tbody;
    table._sortCol=null; table._sortDir=-1;

    function render(){
      tbody.innerHTML="";
      var rs=rows.slice();
      if(table._sortCol!=null){
        var sk=headers[table._sortCol].sortKey, dir=table._sortDir;
        rs.sort(function(a,b){
          var av=a.sort[sk], bv=b.sort[sk];
          if(typeof av==="number"&&typeof bv==="number")return (av-bv)*dir;
          av=""+av; bv=""+bv; return av<bv?-1*dir:av>bv?1*dir:0;
        });
      }
      rs.forEach(function(r){
        var tr=el("tr");
        r.cells.forEach(function(c){
          var td=el("td",{class:c.num?"num":""});
          if(c.html)td.innerHTML=c.html; else td.textContent=c.text;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      if(table._foot){
        table._foot.innerHTML="";
        var ftr=el("tr",{class:"sum"});
        table._footerRow.forEach(function(c){
          var td=el("td",{class:c.num?"num":""});
          if(c.colspan)td.setAttribute("colspan",c.colspan);
          if(c.html)td.innerHTML=c.html; else td.textContent=c.text||"";
          ftr.appendChild(td);
        });
        table._foot.appendChild(ftr);
      }
      $all("th.sortable",thead).forEach(function(th){
        var ci=parseInt(th.dataset.col,10);
        th.setAttribute("aria-sort", table._sortCol===ci?(table._sortDir<0?"descending":"ascending"):"none");
      });
    }
    function sortBy(ci){
      if(table._sortCol===ci)table._sortDir=-table._sortDir; else {table._sortCol=ci;table._sortDir=-1;}
      render();
    }
    table._sortBy=sortBy; render();
    return table;
  }

  function bucketRows(axis){
    var b=BUCKETS[axis]||{}; var rows=[]; var totalCost=0, totalTok=0;
    var vmax=0;
    Object.keys(b).forEach(function(k){if(b[k].cost_usd>vmax)vmax=b[k].cost_usd;});
    vmax=vmax||1;
    Object.keys(b).forEach(function(name){
      var v=b[name]; var io=ioTok(v.tokens), ca=cacheTok(v.tokens); var tot=io+ca;
      totalCost+=v.cost_usd; totalTok+=tot;
      var w=Math.max(0,Math.min(1,v.cost_usd/vmax))*140;
      rows.push({
        sort:{name:name,cost:v.cost_usd,turns:v.turns,io:io,cache:ca,tok:tot},
        cells:[
          {text:name},
          {num:true,text:fmtInt(v.turns)},
          {num:true,text:fmtUSD(v.cost_usd)},
          {html:'<span class="bartrack"><span class="bar" style="width:'+w.toFixed(1)+'px"></span></span>'},
          {num:true,text:fmtInt(io)},
          {num:true,text:fmtInt(ca)}
        ]
      });
    });
    return {rows:rows,totalCost:totalCost,totalTok:totalTok};
  }

  function axisTable(axis){
    var d=bucketRows(axis);
    var headers=[
      {label:"bucket",sortKey:"name"},
      {label:"turns",num:true,sortKey:"turns"},
      {label:"cost USD",num:true,sortKey:"cost"},
      {label:"cost",sortKey:null},
      {label:"in+out tok",num:true,sortKey:"io"},
      {label:"cache tok",num:true,sortKey:"cache"}
    ];
    var recon=(AGG.reconciliation&&AGG.reconciliation[axis])||{};
    var footer=[
      {text:"sum ("+Object.keys(BUCKETS[axis]||{}).length+" buckets)"},
      {num:true,text:""},
      {num:true,text:fmtUSD(d.totalCost)},
      {text:""},
      {num:true,text:fmtInt(d.totalTok)},
      {text:""}
    ];
    return makeTable(headers,d.rows,footer);
  }

  // ----- inline SVG bar chart (top-N by cost) -----
  function barChart(axis,opts){
    opts=opts||{}; var topN=opts.topN||10;
    var b=BUCKETS[axis]||{};
    var items=Object.keys(b).map(function(k){return {name:k,cost:b[k].cost_usd,tok:ioTok(b[k].tokens)+cacheTok(b[k].tokens)};});
    items.sort(function(a,b){return b.cost-a.cost;});
    items=items.slice(0,topN);
    var W=760, rowH=26, padL=160, padR=70, padT=8, padB=8;
    var H=padT+padB+items.length*rowH;
    var vmax=items.reduce(function(m,it){return Math.max(m,it.cost);},0)||1;
    var bw=W-padL-padR;
    var svg=svgEl("svg",{viewBox:"0 0 "+W+" "+Math.max(H,40),width:W,role:"img","aria-label":axis+" cost bar chart"});
    items.forEach(function(it,i){
      var y=padT+i*rowH;
      var w=Math.max(1,(it.cost/vmax)*bw);
      var label=it.name.length>24?it.name.slice(0,23)+"…":it.name;
      svg.appendChild(svgEl("text",{x:padL-8,y:y+rowH/2+4,"text-anchor":"end","font-size":"12",fill:"var(--fg)"})).textContent=label;
      svg.appendChild(svgEl("rect",{x:padL,y:y+4,width:bw,height:rowH-10,rx:3,fill:"var(--line2)"}));
      svg.appendChild(svgEl("rect",{x:padL,y:y+4,width:w,height:rowH-10,rx:3,fill:PALETTE[i%PALETTE.length]}));
      svg.appendChild(svgEl("text",{x:padL+w+6,y:y+rowH/2+4,"font-size":"11",fill:"var(--muted)"})).textContent=fmtUSD2(it.cost);
    });
    if(!items.length){svg.appendChild(svgEl("text",{x:10,y:24,"font-size":"12",fill:"var(--muted)"})).textContent="(no data)";}
    return svg;
  }

  // ----- inline SVG line/area chart of the (filtered) daily series -----
  function dailyChart(metric){ // metric: "cost" | "tokens"
    var days=filteredDaily();
    var W=820, H=240, padL=56, padR=16, padT=16, padB=34;
    var iw=W-padL-padR, ih=H-padT-padB;
    var svg=svgEl("svg",{viewBox:"0 0 "+W+" "+H,width:W,role:"img","aria-label":"daily "+metric+" chart"});
    var vals=days.map(function(d){return metric==="cost"?d.cost_usd:(ioTok(d.tokens)+cacheTok(d.tokens));});
    var vmax=vals.reduce(function(m,v){return Math.max(m,v);},0)||1;
    // gridlines + y labels
    var ticks=4;
    for(var t=0;t<=ticks;t++){
      var yy=padT+ih-(ih*t/ticks);
      svg.appendChild(svgEl("line",{x1:padL,y1:yy,x2:W-padR,y2:yy,stroke:"var(--grid)","stroke-width":"1"}));
      var lv=vmax*t/ticks;
      svg.appendChild(svgEl("text",{x:padL-8,y:yy+4,"text-anchor":"end","font-size":"10",fill:"var(--muted)"}))
        .textContent=metric==="cost"?fmtUSD2(lv):fmtTokShort(lv);
    }
    if(!days.length){svg.appendChild(svgEl("text",{x:padL,y:padT+ih/2,"font-size":"12",fill:"var(--muted)"})).textContent="(no daily data in range)";return svg;}
    var n=days.length;
    function px(i){return n===1?padL+iw/2:padL+(iw*i/(n-1));}
    function py(v){return padT+ih-(v/vmax)*ih;}
    var pts=vals.map(function(v,i){return px(i)+","+py(v);});
    // area
    var area="M "+padL+","+ (padT+ih) +" L "+pts.join(" L ")+" L "+px(n-1)+","+(padT+ih)+" Z";
    svg.appendChild(svgEl("path",{d:area,fill:"var(--accent)","fill-opacity":"0.14",stroke:"none"}));
    svg.appendChild(svgEl("polyline",{points:pts.join(" "),fill:"none",stroke:"var(--accent)","stroke-width":"2"}));
    vals.forEach(function(v,i){
      var c=svgEl("circle",{cx:px(i),cy:py(v),r:"2.6",fill:"var(--accent)"});
      c.appendChild(svgEl("title")).textContent=days[i].day+": "+(metric==="cost"?fmtUSD(v):fmtInt(v)+" tok");
      svg.appendChild(c);
    });
    // x labels (first, mid, last to avoid crowding)
    var idxs=n<=6?days.map(function(_,i){return i;}):[0,Math.floor(n/2),n-1];
    idxs.forEach(function(i){
      svg.appendChild(svgEl("text",{x:px(i),y:H-12,"text-anchor":"middle","font-size":"10",fill:"var(--muted)"})).textContent=days[i].day.slice(5);
    });
    return svg;
  }

  // ----- daily table (filtered) -----
  function dailyTable(){
    var days=filteredDaily();
    var headers=[
      {label:"day",sortKey:"day"},
      {label:"turns",num:true,sortKey:"turns"},
      {label:"cost USD",num:true,sortKey:"cost"},
      {label:"in+out tok",num:true,sortKey:"io"},
      {label:"cache tok",num:true,sortKey:"cache"}
    ];
    var rows=[],tc=0,tt=0;
    days.forEach(function(d){
      var io=ioTok(d.tokens),ca=cacheTok(d.tokens); tc+=d.cost_usd; tt+=io+ca;
      rows.push({sort:{day:d.day,turns:d.turns,cost:d.cost_usd,io:io,cache:ca},
        cells:[{text:d.day},{num:true,text:fmtInt(d.turns)},{num:true,text:fmtUSD(d.cost_usd)},{num:true,text:fmtInt(io)},{num:true,text:fmtInt(ca)}]});
    });
    var footer=[{text:"sum ("+days.length+" days)"},{num:true,text:""},{num:true,text:fmtUSD(tc)},{num:true,text:fmtInt(tt)},{text:""}];
    return makeTable(headers,rows,footer);
  }

  // ----- mount everything -----
  function mountCost(){
    var root=$("#cost-axes"); root.innerHTML="";
    [["model","by model"],["feature","by feature"],["agent","by agent"],["session","by session"]].forEach(function(p){
      if(!BUCKETS[p[0]])return;
      root.appendChild(el("h3",{text:p[1]}));
      root.appendChild(el("div",{class:"chart"},[barChart(p[0],{topN:10})]));
      root.appendChild(axisTable(p[0]));
    });
  }
  function mountTokens(){
    var c=$("#tokens-chart"); c.innerHTML="";
    c.appendChild(dailyChart("tokens"));
    var t=$("#tokens-table"); t.innerHTML=""; t.appendChild(dailyTable());
  }
  function mountDailyCost(){
    var c=$("#cost-daily-chart"); c.innerHTML="";
    c.appendChild(dailyChart("cost"));
  }

  function rerenderRanged(){ mountDailyCost(); mountTokens(); }

  // time-range segmented control
  $all("[data-range]").forEach(function(btn){
    btn.addEventListener("click",function(){
      rangeDays=btn.dataset.range;
      $all("[data-range]").forEach(function(b){b.setAttribute("aria-pressed", b===btn?"true":"false");});
      rerenderRanged();
    });
  });

  mountCost();
  mountDailyCost();
  mountTokens();
})();
"""


def _card(k, v):
    return f'<div class="card"><div class="k">{_esc(k)}</div><div class="v">{v}</div></div>'


def _budget_gauges_html(agg):
    """Render budget gauge(s) + an over-budget flag from result['budget']."""
    budget = agg.get("budget")
    if not budget:
        return ""
    parts = ['<h2>Budget</h2>']
    over = budget.get("over_budget")
    flag = ('<span class="badge bad">OVER BUDGET</span>' if over
            else '<span class="badge ok">within budget</span>')
    parts.append(f'<p>{flag}</p>')

    def gauge(label, row):
        util = row.get("utilization")
        pct = (util * 100.0) if util is not None else 0.0
        cls = "over" if row.get("over") else ("warn" if pct > 80 else "")
        wpct = min(100.0, max(0.0, pct))
        utxt = f"{pct:.1f}%" if util is not None else "n/a"
        return (
            f'<div class="gauge"><div style="flex:0 0 9rem">{_esc(label)}</div>'
            f'<div class="gtrack"><div class="gfill {cls}" style="width:{wpct:.1f}%"></div></div>'
            f'<div style="flex:0 0 auto">{utxt} &middot; '
            f'${row.get("spent_usd",0):.2f} / ${row.get("cap_usd",0):.2f} '
            f'(remaining ${row.get("remaining_usd",0):.2f})</div></div>'
        )

    tot = budget.get("total")
    if tot:
        parts.append(gauge("total", tot))
    if budget.get("buckets"):
        parts.append(f'<h3>per-{_esc(budget.get("axis"))} ceilings</h3>')
        for name, row in budget["buckets"].items():
            parts.append(gauge(name, row))
    return "\n".join(parts)


def _dora_html(payload):
    """Render the Delivery (DORA) panel from dora.py JSON (best-effort)."""
    dora = payload.get("dora")
    if dora is None:
        err = payload.get("dora_error") or "dora.py produced no data."
        return ('<div class="err">DORA metrics unavailable. The cost &amp; token '
                'views above are unaffected.<br><small>' + _esc(err) + '</small></div>')

    def card(title, big, rating, sub):
        rcls = (rating or "").split("/")[0].strip().lower()
        rhtml = (f'<div class="rating {rcls}">{_esc(rating)}</div>' if rating else "")
        shtml = f'<div class="k">{_esc(sub)}</div>' if sub else ""
        return (f'<div class="card"><div class="k">{_esc(title)}</div>'
                f'<div class="v">{_esc(big)}</div>{rhtml}{shtml}</div>')

    df = dora.get("deployment_frequency", {})
    lt = dora.get("lead_time_for_changes", {})
    cf = dora.get("change_failure_rate", {})
    mt = dora.get("mean_time_to_restore", {})
    win = dora.get("window", {})
    meta = dora.get("meta", {})

    cards = [
        card("Deployment frequency", f'{df.get("per_week", 0):.2f}/wk',
             df.get("rating"), f'{df.get("deploys", 0)} deploys in window'),
        card("Lead time for changes", lt.get("median_human") or "n/a",
             lt.get("rating"), f'n={lt.get("sample_size", 0)}'),
        card("Change failure rate", f'{cf.get("rate", 0) * 100:.1f}%',
             cf.get("rating"), f'{cf.get("failed_deploys", 0)}/{cf.get("total_deploys", 0)} deploys'),
        card("Mean time to restore", mt.get("median_human") or "n/a",
             mt.get("rating"), f'{mt.get("unresolved_failures", 0)} unresolved'),
    ]
    h = ['<h2>Delivery (DORA)</h2>']
    span = win.get("span_days")
    h.append(f'<p class="sub">window {_esc(win.get("start", "?"))[:10]} &rarr; '
             f'{_esc(win.get("end", "?"))[:10]} ({span} days) &middot; '
             f'deploy proxy: {_esc(meta.get("deploy_proxy", "?"))}</p>')
    h.append('<div class="dora-grid">' + "".join(cards) + '</div>')
    return "\n".join(h)


def render_html(payload):
    agg = payload.get("aggregate") or {}
    tk = agg.get("total_tokens") or {}
    cache_w = (tk.get("cache_write_5m", 0) + tk.get("cache_write_1h", 0))
    io = (tk.get("input", 0) + tk.get("output", 0))
    reconciled = agg.get("reconciled")
    recon_badge = ('<span class="badge ok">reconciled</span>' if reconciled
                   else '<span class="badge bad">NOT reconciled</span>')
    title = payload.get("title") or "ai-core-kit cost dashboard"
    gen = payload.get("generated_at")
    issue = payload.get("issue_url")

    range_note = ""
    if payload.get("since") or payload.get("until"):
        range_note = (f' &middot; range {_esc(payload.get("since") or "...")} '
                      f'&rarr; {_esc(payload.get("until") or "now")}')

    auto_reload = payload.get("_auto_reload_seconds")
    meta_refresh = (f'<meta http-equiv="refresh" content="{int(auto_reload)}">'
                    if auto_reload else "")

    h = []
    h.append("<!doctype html>")
    h.append('<html lang="en"><head><meta charset="utf-8">')
    h.append('<meta name="viewport" content="width=device-width, initial-scale=1">')
    h.append(meta_refresh)
    h.append(f"<title>{_esc(title)}</title>")
    h.append(f"<style>{_STYLE}</style></head><body>")

    h.append(f"<h1>{_esc(title)}</h1>")
    h.append(
        f'<div class="banner"><span class="dot"></span>'
        f'<strong>OFFLINE</strong> &middot; cost is recomputed from transcript '
        f'<code>message.usage</code> &times; <code>pricing.json</code> &mdash; '
        f'there is no live token meter (<a href="{_esc(issue)}">claude-code#11008</a>). '
        f'Recomputed at <strong>{_esc(gen)}</strong>{range_note}.</div>'
    )
    h.append(
        f'<p class="sub">pricing as_of {_esc(agg.get("pricing_as_of"))} &middot; '
        f'files scanned {agg.get("files_scanned", 0):,} &middot; '
        f'turns {agg.get("assistant_turns", 0):,} &middot; {recon_badge}</p>'
    )

    h.append('<div class="cards">')
    h.append(_card("Grand total", f'${agg.get("total_cost_usd", 0):.4f}'))
    h.append(_card("Assistant turns", f'{agg.get("assistant_turns", 0):,}'))
    h.append(_card("Input + output tok", f'{io:,}'))
    h.append(_card("Cache tok (read / write)", f'{tk.get("cache_read", 0):,} / {cache_w:,}'))
    h.append("</div>")

    # tabs
    h.append('<div class="tabs" role="tablist">')
    h.append('<button class="tab" role="tab" data-tab="cost" aria-selected="true">Cost</button>')
    h.append('<button class="tab" role="tab" data-tab="tokens" aria-selected="false">Tokens</button>')
    h.append('<button class="tab" role="tab" data-tab="delivery" aria-selected="false">Delivery (DORA)</button>')
    h.append("</div>")

    # Cost panel
    h.append('<section class="panel active" id="panel-cost" role="tabpanel">')
    h.append('<div class="controls"><label>Time range</label>'
             '<span class="seg">'
             '<button data-range="7" aria-pressed="false">7d</button>'
             '<button data-range="30" aria-pressed="false">30d</button>'
             '<button data-range="all" aria-pressed="true">all</button>'
             '</span></div>')
    h.append('<h3>daily cost</h3><div class="chart" id="cost-daily-chart"></div>')
    h.append(_budget_gauges_html(agg))
    h.append('<div id="cost-axes"></div>')
    h.append('</section>')

    # Tokens panel
    h.append('<section class="panel" id="panel-tokens" role="tabpanel">')
    h.append('<p class="sub">Filtered by the time-range control on the Cost tab.</p>')
    h.append('<h3>daily tokens (input+output+cache)</h3>')
    h.append('<div class="chart" id="tokens-chart"></div>')
    h.append('<div id="tokens-table"></div>')
    h.append('</section>')

    # Delivery panel
    h.append('<section class="panel" id="panel-delivery" role="tabpanel">')
    h.append(_dora_html(payload))
    h.append('</section>')

    # footer
    reload_note = (f' &middot; auto-reload every {int(auto_reload)}s' if auto_reload else "")
    h.append(
        f'<footer>ai-core-kit offline cost dashboard &middot; self-contained '
        f'(no network, no deps) &middot; generated {_esc(gen)}'
        f'{reload_note} &middot; reconciled: {"yes" if reconciled else "NO"}</footer>'
    )

    # inlined data + client
    h.append('<script>window.__ACK_DATA__=' + _json_for_script(payload) + ';</script>')
    h.append('<script>' + _SCRIPT + '</script>')
    h.append("</body></html>")
    return "\n".join(h) + "\n"


def build_html(args, auto_reload_seconds=None):
    """Gather data and render the full self-contained HTML string."""
    payload = gather(args)
    if auto_reload_seconds:
        payload["_auto_reload_seconds"] = auto_reload_seconds
    return render_html(payload)


# ---------------------------------------------------------------------------
# --serve mode -- local, zero-infra "live" dashboard (regenerate per request)
# ---------------------------------------------------------------------------
def serve(args):
    import http.server

    auto_reload = args.watch if args.watch else None
    bound_args = args

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path not in ("/", "/index.html", "/dashboard.html"):
                self.send_error(404, "not found (dashboard serves '/')")
                return
            try:
                html = build_html(bound_args, auto_reload_seconds=auto_reload)
            except DashboardError as e:
                body = (f"<!doctype html><meta charset=utf-8>"
                        f"<body style='font-family:system-ui;padding:2rem'>"
                        f"<h1>dashboard error</h1><pre>{_esc(e)}</pre>"
                        f"<p>The cost engine failed. Fix the error above and reload.</p>"
                        f"</body>").encode("utf-8")
                self.send_response(500)
                self.send_header("Content-Type", "text/html; charset=utf-8")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return
            body = html.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def log_message(self, fmt, *a):  # quieter than default
            sys.stderr.write("  " + (fmt % a) + "\n")

    addr = ("127.0.0.1", args.port)
    httpd = http.server.HTTPServer(addr, Handler)
    url = f"http://127.0.0.1:{args.port}/"
    watch_note = (f" (auto-reload every {args.watch}s)" if args.watch else "")
    print(f"ai-core-kit offline cost dashboard serving at {url}{watch_note}", file=sys.stderr)
    print("regenerated on each request - OFFLINE, recomputed from transcripts "
          "(claude-code#11008). Ctrl-C to stop.", file=sys.stderr)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped.", file=sys.stderr)
    finally:
        httpd.server_close()
    return 0


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def build_parser():
    ap = argparse.ArgumentParser(
        prog="dashboard.py",
        description="Self-contained interactive OFFLINE cost dashboard "
                    "(wraps aggregate.py + dora.py; no network, no deps).",
    )
    ap.add_argument("--out", default="cost-dashboard.html",
                    help="output HTML file (default: cost-dashboard.html)")
    ap.add_argument("--since", default=None, help="only count turns on/after YYYY-MM-DD (UTC)")
    ap.add_argument("--until", default=None, help="only count turns BEFORE YYYY-MM-DD (UTC, exclusive)")
    ap.add_argument("--pricing", default=None,
                    help="pricing map JSON (default: aggregate.py's own pricing.json)")
    ap.add_argument("--title", default="ai-core-kit cost dashboard",
                    help="dashboard page title / H1")
    ap.add_argument("--budget", type=float, default=None,
                    help="advisory total USD ceiling -> renders a budget gauge + over-budget flag")
    ap.add_argument("--budget-axis", default="session",
                    choices=("model", "feature", "agent", "session", "day"),
                    help="axis the budget gauge is associated with (default: session)")
    ap.add_argument("--serve", action="store_true",
                    help="serve a live dashboard on localhost, regenerated per request")
    ap.add_argument("--port", type=int, default=8787,
                    help="port for --serve (default: 8787, bound to 127.0.0.1)")
    ap.add_argument("--watch", type=int, default=None, metavar="SECONDS",
                    help="with --serve: auto-reload the page every SECONDS (meta-refresh)")
    ap.add_argument("--once", action="store_true",
                    help="write the file once and exit (the default when --serve is absent)")
    return ap


def main(argv=None):
    ap = build_parser()
    args = ap.parse_args(argv)

    if args.serve:
        try:
            return serve(args)
        except DashboardError as e:
            print(f"FATAL: {e}", file=sys.stderr)
            return 1

    # default / --once: write a single self-contained file
    try:
        html = build_html(args)
    except DashboardError as e:
        print(f"FATAL: {e}", file=sys.stderr)
        return 1
    try:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(html)
    except OSError as e:
        print(f"FATAL: cannot write {args.out}: {e}", file=sys.stderr)
        return 1
    print(f"wrote {args.out} ({len(html):,} bytes) - OFFLINE, self-contained "
          f"(no network, no deps).", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
