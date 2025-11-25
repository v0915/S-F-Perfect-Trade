// Robust integer parser (digit-by-digit)
function toInt(v){
  const s = String(v ?? '').replace(/[^\d-]/g,'');
  return s.length ? parseInt(s,10) : 0;
}

const STORAGE_KEY = 'confluence_checklist_v2';

// helpers
function getSections(){ return Array.from(document.querySelectorAll('section.card[data-section]')); }
function getSectionRows(sectionEl){ return Array.from(sectionEl.querySelectorAll('.card-body .row')); }

// read numeric value from row (supports input or label)
function readRowValue(row){
  if(!row) return 0;
  const r = row.querySelector('.right');
  if(!r) return 0;
  const input = r.querySelector('.pct-input');
  if(input) return toInt(input.value);
  const lbl = r.querySelector('.pct-label');
  if(lbl && lbl.dataset && lbl.dataset.value) return toInt(lbl.dataset.value);
  const raw = r.querySelector('.pct')?.textContent || '';
  return toInt(raw);
}

// write numeric into row (updates label, input and toggle dataset)
function writeRowValue(row, num){
  const r = row.querySelector('.right');
  if(!r) return;
  const lbl = r.querySelector('.pct-label');
  const input = r.querySelector('.pct-input');
  if(input) input.value = String(num);
  if(lbl){
    lbl.dataset.value = String(num);
    lbl.textContent = (num >= 0 ? '+' + num + '%' : num + '%');
  }
  if(!lbl && !input){
    const pctWrap = r.querySelector('.pct') || r;
    const span = document.createElement('span');
    span.className = 'pct-label';
    span.dataset.value = String(num);
    span.textContent = (num >= 0 ? '+' + num + '%' : num + '%');
    if(pctWrap) pctWrap.appendChild(span);
  }
  const toggle = row.querySelector('.toggle');
  if(toggle) toggle.dataset.value = String(num);
}

function readRowToggle(row){ const t = row.querySelector('.toggle'); return t ? !!t.checked : false; }
function writeRowToggle(row, val){ const t = row.querySelector('.toggle'); if(t) t.checked = !!val; }

// save structured settings
function saveSettings(){
  const out = {};
  getSections().forEach(sec=>{
    const key = sec.dataset.section || 'unknown';
    out[key] = [];
    getSectionRows(sec).forEach(row=>{
      out[key].push({ value: readRowValue(row), checked: readRowToggle(row) });
    });
  });
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify({ meta:{savedAt:Date.now()}, sections:out })); }
  catch(e){ console.warn('saveSettings error', e); }
}

// load structured settings
function loadSettings(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return;
  try{
    const parsed = JSON.parse(raw);
    if(!parsed || !parsed.sections) return;
    const saved = parsed.sections;
    getSections().forEach(sec=>{
      const key = sec.dataset.section || 'unknown';
      const rows = getSectionRows(sec);
      const savedRows = Array.isArray(saved[key]) ? saved[key] : [];
      rows.forEach((row, idx)=>{
        const item = savedRows[idx];
        if(item){
          writeRowValue(row, toInt(item.value));
          writeRowToggle(row, !!item.checked);
        }
      });
    });
  }catch(e){
    console.warn('loadSettings error', e);
  }
}

// update totals
function updateAllTotals(){
  getSections().forEach(sec=>{
    const key = sec.dataset.section;
    let total = 0;
    getSectionRows(sec).forEach(row=>{
      const t = row.querySelector('.toggle');
      if(t && t.checked) total += readRowValue(row);
    });
    const totalEl = document.getElementById('total-' + key) || sec.querySelector('.total');
    if(totalEl) totalEl.textContent = total + '%';
  });
  updateSummaryFromSections();
}

// update summary
function updateSummaryFromSections(){
  const mapping = [
    {sec:'weekly', elId:'summary-weekly'},
    {sec:'daily', elId:'summary-daily'},
    {sec:'4h', elId:'summary-4h'},
    {sec:'lower-multiples', elId:'summary-lower-multiples'},
    {sec:'entry-signal', elId:'summary-entry-signal'}
  ];
  let overall = 0;
  mapping.forEach(m=>{
    const totalEl = document.getElementById('total-' + m.sec);
    const val = totalEl ? toInt(totalEl.textContent) : 0;
    const summaryEl = document.getElementById(m.elId);
    if(summaryEl) summaryEl.textContent = val + '%';
    overall += val;
  });
  const overallEl = document.getElementById('summary-overall');
  if(overallEl) overallEl.textContent = overall + '%';
  const labelEl = document.getElementById('summary-label');
  if(labelEl){
    let label = 'No confluence';
    if(overall >= 100) label = 'Strong Confluence ✓';
    else if(overall >= 60) label = 'Moderate Confluence';
    else if(overall > 0) label = 'Weak Confluence';
    labelEl.textContent = label;
  }
}

// wire toggles
function wireToggles(){
  document.querySelectorAll('.toggle').forEach(t=>{
    t.removeEventListener('change', onToggleChange);
    t.addEventListener('change', onToggleChange);
  });
}

function onToggleChange(e){
  const t = e.currentTarget;
  const row = t.closest('.row');
  const v = readRowValue(row);
  if(t) t.dataset.value = String(v);
  updateAllTotals();
  saveSettings();
}

// edit percentages
let editing = false;
const editBtn = document.getElementById('editPctBtn');
if(editBtn){
  editBtn.addEventListener('click', ()=>{
    editing = !editing;
    toggleEditMode(editing);
    editBtn.textContent = editing ? 'Done editing' : 'Edit percentages';
    if(!editing){
      // commit all inputs
      getSections().forEach(sec=>{
        getSectionRows(sec).forEach(row=>{
          const r = row.querySelector('.right');
          if(!r) return;
          const input = r.querySelector('.pct-input');
          if(input){
            const v = toInt(input.value);
            const span = document.createElement('span');
            span.className = 'pct-label';
            span.dataset.value = String(v);
            span.textContent = (v >= 0 ? '+' + v + '%' : v + '%');
            const pctWrap = r.querySelector('.pct');
            if(pctWrap){
              const existing = pctWrap.querySelector('.pct-label') || pctWrap.firstChild;
              if(existing) pctWrap.replaceChild(span, existing);
              else pctWrap.appendChild(span);
            } else {
              input.parentElement.replaceChild(span, input);
            }
            const toggle = row.querySelector('.toggle');
            if(toggle) toggle.dataset.value = String(v);
          } else {
            const span = r.querySelector('.pct-label');
            if(span){
              const v = toInt(span.dataset.value);
              span.dataset.value = String(v);
              span.textContent = (v >= 0 ? '+' + v + '%' : v + '%');
              const toggle = row.querySelector('.toggle');
              if(toggle) toggle.dataset.value = String(v);
            }
          }
        });
      });
      updateAllTotals();
      saveSettings();
    }
  });
}

function toggleEditMode(on){
  getSections().forEach(sec=>{
    getSectionRows(sec).forEach(row=>{
      const r = row.querySelector('.right');
      if(!r) return;
      const span = r.querySelector('.pct-label');
      if(on && span){
        const val = toInt(span.dataset.value);
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'pct-input';
        input.value = String(val);
        input.title = 'Enter whole number (e.g. 5 or 10)';
        input.addEventListener('keydown', (e)=>{
          if(e.key === 'Enter') e.target.blur();
        });
        input.addEventListener('blur', (e)=>{
          const v = toInt(e.target.value);
          const toggle = row.querySelector('.toggle');
          if(toggle) toggle.dataset.value = String(v);
          e.target.value = String(v);
        });
        const pctWrap = r.querySelector('.pct');
        if(pctWrap && pctWrap.contains(span)) pctWrap.replaceChild(input, span);
        else span.parentElement.replaceChild(input, span);
        input.focus();
      }
    });
  });
  wireToggles();
}

// clear saved (topbar)
const clearBtn = document.getElementById('clearBtn');
if(clearBtn){
  clearBtn.addEventListener('click', ()=>{
    if(confirm('Clear saved settings (percentages and toggles)?')){
      localStorage.removeItem(STORAGE_KEY);
      location.reload();
    }
  });
}

// reset all
const resetAllBtn = document.getElementById('resetAllBtn');
if(resetAllBtn){
  resetAllBtn.addEventListener('click', ()=>{
    if(!confirm('Reset ALL percentages to +0% and turn all toggles OFF?')) return;
    getSections().forEach(sec=>{
      getSectionRows(sec).forEach(row=>{
        const r = row.querySelector('.right');
        if(!r) return;
        const input = r.querySelector('.pct-input');
        if(input){
          const span = document.createElement('span');
          span.className = 'pct-label';
          span.dataset.value = '0';
          span.textContent = '+0%';
          const pctWrap = r.querySelector('.pct');
          if(pctWrap && pctWrap.contains(input)) pctWrap.replaceChild(span, input);
          else input.parentElement.replaceChild(span, input);
        } else {
          const span = r.querySelector('.pct-label');
          if(span){
            span.dataset.value = '0';
            span.textContent = '+0%';
          } else {
            const pctWrap = r.querySelector('.pct') || r;
            const spanNew = document.createElement('span');
            spanNew.className = 'pct-label';
            spanNew.dataset.value = '0';
            spanNew.textContent = '+0%';
            if(pctWrap) pctWrap.appendChild(spanNew);
          }
        }
        const toggle = row.querySelector('.toggle');
        if(toggle){
          toggle.checked = false;
          toggle.dataset.value = '0';
          try{
            const ev = new Event('change', { bubbles: true });
            toggle.dispatchEvent(ev);
          }catch(e){
            toggle.onchange && toggle.onchange();
          }
        }
      });
    });
    localStorage.removeItem(STORAGE_KEY);
    updateAllTotals();
    const overallEl = document.getElementById('summary-overall');
    if(overallEl){
      overallEl.style.transform = 'scale(1.06)';
      setTimeout(()=> overallEl.style.transform = '', 280);
    }
  });
}

// init
document.addEventListener('DOMContentLoaded', ()=>{
  // ensure pct-label exists for each row
  getSections().forEach(sec=>{
    getSectionRows(sec).forEach(row=>{
      const r = row.querySelector('.right');
      if(!r) return;
      const pctWrap = r.querySelector('.pct');
      if(pctWrap && !pctWrap.querySelector('.pct-label')){
        const raw = pctWrap.textContent || '';
        const v = toInt(raw);
        pctWrap.textContent = '';
        const span = document.createElement('span');
        span.className = 'pct-label';
        span.dataset.value = String(v);
        span.textContent = (v >= 0 ? '+' + v + '%' : v + '%');
        pctWrap.appendChild(span);
      }
      const span = r.querySelector('.pct-label');
      const toggle = r.querySelector('.toggle');
      if(span && toggle) toggle.dataset.value = span.dataset.value;
    });
  });

  // enforce 4H Trend = 10% (just in case)
  try{
    const sec4h = document.querySelector('section.card[data-section="4h"]');
    if(sec4h){
      const rows = getSectionRows(sec4h);
      const trendRow = rows.find(r => (r.querySelector('.label')?.textContent || '').trim().toLowerCase() === 'trend');
      if(trendRow) writeRowValue(trendRow, 10);
    }
  }catch(e){ /* ignore */ }

  // load saved user settings
  loadSettings();

  // normalize all rows and ensure toggles' dataset match
  getSections().forEach(sec=>{
    getSectionRows(sec).forEach(row=>{
      const span = row.querySelector('.pct-label');
      if(span){
        const v = toInt(span.dataset.value);
        span.dataset.value = String(v);
        span.textContent = (v >= 0 ? '+' + v + '%' : v + '%');
      }
      const input = row.querySelector('.pct-input');
      if(input) input.value = String(toInt(input.value));
      const toggle = row.querySelector('.toggle');
      if(toggle) toggle.dataset.value = String(readRowValue(row));
    });
  });

  // wire and calculate
  wireToggles();
  updateAllTotals();
});
