const UGX = new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', maximumFractionDigits: 0 });
const KEY = 'depotSystem.v1';
const today = () => new Date().toISOString().slice(0,10);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36)+Math.random().toString(36).slice(2);
const money = n => UGX.format(Number(n || 0));
const num = id => Number(document.getElementById(id).value || 0);
const val = id => document.getElementById(id).value.trim();
const $ = id => document.getElementById(id);

let db = load();
function load(){
  const raw = localStorage.getItem(KEY);
  if(raw) return JSON.parse(raw);
  return { items:[], received:[], sales:[], expenses:[], customers:[{id:'walkin',name:'Walk-in Customer',phone:'',address:''}], suppliers:[{id:'unknown',name:'Unknown Supplier',phone:'',address:''}] };
}
function save(){ localStorage.setItem(KEY, JSON.stringify(db)); }
function toast(msg){ const t=$('toast'); t.textContent=msg; t.classList.add('show-toast'); setTimeout(()=>t.classList.remove('show-toast'),2200); }
function byId(arr,id){ return arr.find(x=>x.id===id); }
function remove(arr,id){ const i=arr.findIndex(x=>x.id===id); if(i>-1) arr.splice(i,1); }
function inRange(date, from, to){ return (!from || date>=from) && (!to || date<=to); }

const titles = {
  dashboard:['Dashboard','Today’s business summary'], items:['Items / Stock','Create items and manage prices'], receive:['Received Items','Add stock from suppliers'], sales:['Sales','Sell items and calculate profit'], receipts:['Receipts','Print and download customer receipts'], expenses:['Expenses','Track depot costs'], customers:['Customers','Manage customer records'], suppliers:['Suppliers','Manage supplier records'], reports:['Reports','Profit / loss and daily totals'], backup:['Backup','Export, restore, or reset data']
};

function route(){
  const page = location.hash.replace('#','') || 'dashboard';
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(a=>a.classList.remove('active'));
  (document.getElementById(page) || $('dashboard')).classList.add('active');
  const link = document.querySelector(`a[href="#${page}"]`); if(link) link.classList.add('active');
  $('pageTitle').textContent = (titles[page]||titles.dashboard)[0];
  $('pageSubtitle').textContent = (titles[page]||titles.dashboard)[1];
  render();
}
window.addEventListener('hashchange', route);

function options(){
  const itemOptions = db.items.map(i=>`<option value="${i.id}">${i.name} - ${i.qty} ${i.unit}</option>`).join('');
  ['receiveItem','saleItem'].forEach(id=>$(id).innerHTML = itemOptions || '<option value="">No items yet</option>');
  $('receiveSupplier').innerHTML = db.suppliers.map(s=>`<option value="${s.id}">${s.name}</option>`).join('');
  $('saleCustomer').innerHTML = db.customers.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
}
function actionBtn(txt, fn, cls='secondary'){ return `<button class="mini ${cls}" onclick="${fn}">${txt}</button>`; }
function render(){ options(); renderItems(); renderReceive(); renderSales(); renderReceipts(); renderExpenses(); renderPeople(); renderDashboard(); renderReports(); }

function renderItems(){
  const q = ($('itemSearch')?.value || '').toLowerCase();
  $('itemsTable').innerHTML = db.items.filter(i=>i.name.toLowerCase().includes(q)).map(i=>{
    const wholesale = Number(i.wholesale ?? i.retail ?? 0);
    const retailProfit = i.retail - i.cost;
    const wholesaleProfit = wholesale - i.cost;
    const margin = i.retail ? (retailProfit / i.retail * 100) : 0;
    return `<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.unit}</td><td>${money(i.cost)}</td><td>${money(i.retail)}</td><td>${money(wholesale)}</td><td>${money(retailProfit)}</td><td>${money(wholesaleProfit)}</td><td>${margin.toFixed(1)}%</td><td>${actionBtn('Edit',`editItem('${i.id}')`)} ${actionBtn('Delete',`deleteItem('${i.id}')`,'danger')}</td></tr>`;
  }).join('') || '<tr><td colspan="10">No items yet.</td></tr>';
}
function renderReceive(){
  $('receiveTable').innerHTML = db.received.slice().reverse().map(r=>{
    const item=byId(db.items,r.itemId)||{}; const sup=byId(db.suppliers,r.supplierId)||{};
    return `<tr><td>${r.date}</td><td>${sup.name||''}</td><td>${item.name||'Deleted item'}</td><td>${r.qty}</td><td>${money(r.unitCost)}</td><td>${money(r.qty*r.unitCost)}</td><td>${actionBtn('Delete',`deleteReceive('${r.id}')`,'danger')}</td></tr>`;
  }).join('') || '<tr><td colspan="7">No received items yet.</td></tr>';
}
function renderSales(){
  $('salesTable').innerHTML = db.sales.slice().reverse().map(s=>{
    const item=byId(db.items,s.itemId)||{}; const c=byId(db.customers,s.customerId)||{};
    const sales=s.qty*s.price, cost=s.qty*s.cost, profit=sales-cost;
    return `<tr><td>${s.date}</td><td>${c.name||''}</td><td>${item.name||'Deleted item'}</td><td>${s.qty}</td><td>${s.priceType||'retail'}</td><td>${money(sales)}</td><td>${money(cost)}</td><td class="${profit>=0?'profit':'loss'}">${money(profit)}</td><td>${actionBtn('View',`previewReceipt('${s.id}')`)} ${actionBtn('Print',`printReceipt('${s.id}')`)}</td><td>${actionBtn('Delete',`deleteSale('${s.id}')`,'danger')}</td></tr>`;
  }).join('') || '<tr><td colspan="10">No sales yet.</td></tr>';
}

function receiptNo(s){ return 'RCT-' + String(db.sales.findIndex(x=>x.id===s.id)+1).padStart(5,'0'); }
function receiptHtml(id){
  const s=byId(db.sales,id); if(!s) return '<p>Receipt not found.</p>';
  const item=byId(db.items,s.itemId)||{}; const c=byId(db.customers,s.customerId)||{};
  const total=s.qty*s.price, cost=s.qty*s.cost, profit=total-cost;
  return `<div class="receipt"><h2>Depot Receipt</h2><p><b>Receipt No:</b> ${receiptNo(s)}</p><p><b>Date:</b> ${s.date}</p><p><b>Customer:</b> ${c.name||'Walk-in Customer'}</p><hr><table><tr><th>Item</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr><tr><td>${item.name||'Deleted item'}</td><td>${s.qty}</td><td>${money(s.price)}</td><td>${money(total)}</td></tr></table><p><b>Price Type:</b> ${s.priceType||'retail'}</p><p><b>Payment:</b> ${s.payment||''}</p><h3>Total Paid: ${money(total)}</h3><p class="muted">Thank you for your business.</p></div>`;
}
function renderReceipts(){
  const table=$('receiptsTable'); if(!table) return;
  table.innerHTML = db.sales.slice().reverse().map(s=>{ const item=byId(db.items,s.itemId)||{}; const c=byId(db.customers,s.customerId)||{}; return `<tr><td>${s.date}</td><td>${receiptNo(s)}</td><td>${c.name||''}</td><td>${item.name||'Deleted item'}</td><td>${s.qty}</td><td>${money(s.qty*s.price)}</td><td>${actionBtn('Preview',`previewReceipt('${s.id}')`)} ${actionBtn('Print',`printReceipt('${s.id}')`)} ${actionBtn('Download',`downloadReceipt('${s.id}')`)}</td></tr>`; }).join('') || '<tr><td colspan="7">No receipts yet. Receipts are created automatically from sales.</td></tr>';
}
window.previewReceipt=id=>{ $('receiptBox').innerHTML=receiptHtml(id); location.hash='receipts'; };
window.printReceipt=id=>{ const w=window.open('', '_blank'); w.document.write(`<html><head><title>Receipt</title><link rel="stylesheet" href="style.css"></head><body class="print-receipt">${receiptHtml(id)}<script>window.print()<\/script></body></html>`); w.document.close(); };
window.downloadReceipt=id=>{ const s=byId(db.sales,id); if(!s)return; download(`${receiptNo(s)}.html`, `<!doctype html><html><head><meta charset="utf-8"><title>${receiptNo(s)}</title><link rel="stylesheet" href="style.css"></head><body class="print-receipt">${receiptHtml(id)}</body></html>`, 'text/html'); };

function renderExpenses(){
  $('expensesTable').innerHTML = db.expenses.slice().reverse().map(e=>`<tr><td>${e.date}</td><td>${e.category}</td><td>${e.desc}</td><td>${money(e.amount)}</td><td>${actionBtn('Delete',`deleteExpense('${e.id}')`,'danger')}</td></tr>`).join('') || '<tr><td colspan="5">No expenses yet.</td></tr>';
}
function renderPeople(){
  $('customersTable').innerHTML = db.customers.map(c=>`<tr><td>${c.name}</td><td>${c.phone}</td><td>${c.address}</td><td>${c.id==='walkin'?'':actionBtn('Delete',`deleteCustomer('${c.id}')`,'danger')}</td></tr>`).join('');
  $('suppliersTable').innerHTML = db.suppliers.map(s=>`<tr><td>${s.name}</td><td>${s.phone}</td><td>${s.address}</td><td>${s.id==='unknown'?'':actionBtn('Delete',`deleteSupplier('${s.id}')`,'danger')}</td></tr>`).join('');
}
function totals(from='',to=''){
  const sales = db.sales.filter(s=>inRange(s.date,from,to));
  const expenses = db.expenses.filter(e=>inRange(e.date,from,to));
  const received = db.received.filter(r=>inRange(r.date,from,to));
  const totalSales = sales.reduce((a,s)=>a+s.qty*s.price,0);
  const totalCost = sales.reduce((a,s)=>a+s.qty*s.cost,0);
  const totalExpenses = expenses.reduce((a,e)=>a+e.amount,0);
  const receivedValue = received.reduce((a,r)=>a+r.qty*r.unitCost,0);
  const gross = totalSales-totalCost;
  const net = gross-totalExpenses;
  return {totalSales,totalCost,totalExpenses,receivedValue,gross,net};
}
function renderDashboard(){
  const t=totals(); const stock=db.items.reduce((a,i)=>a+i.qty*i.cost,0);
  $('kpiSales').textContent=money(t.totalSales); $('kpiExpenses').textContent=money(t.totalExpenses); $('kpiStock').textContent=money(stock); $('kpiProfit').textContent=money(t.net); $('kpiProfit').className=t.net>=0?'profit':'loss';
  $('lowStockTable').innerHTML = db.items.filter(i=>i.qty<=i.alert).map(i=>`<tr><td>${i.name}</td><td>${i.qty}</td><td>${i.unit}</td></tr>`).join('') || '<tr><td colspan="3">No low stock items.</td></tr>';
  const acts = [
    ...db.sales.map(s=>({date:s.date,type:'Sale',details:(byId(db.items,s.itemId)||{}).name,amount:s.qty*s.price})),
    ...db.expenses.map(e=>({date:e.date,type:'Expense',details:e.desc,amount:e.amount})),
    ...db.received.map(r=>({date:r.date,type:'Received',details:(byId(db.items,r.itemId)||{}).name,amount:r.qty*r.unitCost}))
  ].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,8);
  $('recentTable').innerHTML = acts.map(a=>`<tr><td>${a.date}</td><td>${a.type}</td><td>${a.details||''}</td><td>${money(a.amount)}</td></tr>`).join('') || '<tr><td colspan="4">No activity yet.</td></tr>';
}
function renderReports(){
  const from=$('reportFrom').value, to=$('reportTo').value, t=totals(from,to);
  $('reportSales').textContent=money(t.totalSales); $('reportCost').textContent=money(t.totalCost); $('reportExpenses').textContent=money(t.totalExpenses); $('reportProfit').textContent=money(t.net); $('reportProfit').className=t.net>=0?'profit':'loss';
  const dates = [...new Set([...db.sales.map(x=>x.date),...db.received.map(x=>x.date),...db.expenses.map(x=>x.date)])].filter(d=>inRange(d,from,to)).sort().reverse();
  $('reportTable').innerHTML = dates.map(d=>{
    const td=totals(d,d); return `<tr><td>${d}</td><td>${money(td.totalSales)}</td><td>${money(td.receivedValue)}</td><td>${money(td.totalExpenses)}</td><td>${money(td.gross)}</td><td class="${td.net>=0?'profit':'loss'}">${money(td.net)}</td><td>${money(td.totalSales+td.receivedValue-td.totalExpenses)}</td></tr>`;
  }).join('') || '<tr><td colspan="7">No report data.</td></tr>';
}

$('itemForm').onsubmit=e=>{ e.preventDefault(); const id=val('itemId')||uid(); const existing=byId(db.items,id); const item={id,name:val('itemName'),unit:val('itemUnit'),qty:num('itemQty'),cost:num('itemCost'),retail:num('itemRetail'),wholesale:num('itemWholesale'),alert:num('itemAlert')}; if(existing) Object.assign(existing,item); else db.items.push(item); save(); e.target.reset(); $('itemId').value=''; $('itemAlert').value=5; render(); toast('Item saved'); };
$('clearItemForm').onclick=()=>{$('itemForm').reset();$('itemId').value='';$('itemAlert').value=5;};
window.editItem=id=>{ const i=byId(db.items,id); if(!i)return; $('itemId').value=i.id; $('itemName').value=i.name; $('itemUnit').value=i.unit; $('itemQty').value=i.qty; $('itemCost').value=i.cost; $('itemRetail').value=i.retail; $('itemWholesale').value=i.wholesale ?? i.retail; $('itemAlert').value=i.alert; location.hash='items'; };
window.deleteItem=id=>{ if(confirm('Delete this item?')){ remove(db.items,id); save(); render(); }};
$('itemSearch').oninput=renderItems;

$('receiveForm').onsubmit=e=>{ e.preventDefault(); const item=byId(db.items,val('receiveItem')); if(!item) return toast('Create an item first'); const qty=num('receiveQty'), cost=num('receiveCost'); db.received.push({id:uid(),date:val('receiveDate'),supplierId:val('receiveSupplier'),itemId:item.id,qty,unitCost:cost,notes:val('receiveNotes')}); item.qty += qty; item.cost = cost; save(); e.target.reset(); setDates(); render(); toast('Stock received'); };
window.deleteReceive=id=>{ const r=byId(db.received,id); const item=r&&byId(db.items,r.itemId); if(confirm('Delete received record and reduce stock?')){ if(item) item.qty-=r.qty; remove(db.received,id); save(); render(); }};

function updateSalePrice(){ const i=byId(db.items,val('saleItem')); if(!i)return; const type=val('salePriceType'); if(type==='wholesale') $('salePrice').value=i.wholesale ?? i.retail; else if(type==='retail') $('salePrice').value=i.retail; }
$('saleItem').onchange=updateSalePrice; $('salePriceType').onchange=updateSalePrice;
$('saleForm').onsubmit=e=>{ e.preventDefault(); const item=byId(db.items,val('saleItem')); if(!item) return toast('Create an item first'); const qty=num('saleQty'); if(qty>item.qty) return toast('Not enough stock'); const price=num('salePrice'); db.sales.push({id:uid(),date:val('saleDate'),customerId:val('saleCustomer'),itemId:item.id,qty,price,cost:item.cost,priceType:val('salePriceType'),payment:val('salePayment')}); item.qty-=qty; save(); e.target.reset(); setDates(); render(); toast('Sale saved'); };
window.deleteSale=id=>{ const s=byId(db.sales,id); const item=s&&byId(db.items,s.itemId); if(confirm('Delete sale and return stock?')){ if(item) item.qty+=s.qty; remove(db.sales,id); save(); render(); }};

$('expenseForm').onsubmit=e=>{ e.preventDefault(); db.expenses.push({id:uid(),date:val('expenseDate'),category:val('expenseCategory'),desc:val('expenseDesc'),amount:num('expenseAmount')}); save(); e.target.reset(); setDates(); render(); toast('Expense saved'); };
window.deleteExpense=id=>{ if(confirm('Delete expense?')){ remove(db.expenses,id); save(); render(); }};
$('customerForm').onsubmit=e=>{ e.preventDefault(); db.customers.push({id:uid(),name:val('customerName'),phone:val('customerPhone'),address:val('customerAddress')}); save(); e.target.reset(); render(); toast('Customer saved'); };
$('supplierForm').onsubmit=e=>{ e.preventDefault(); db.suppliers.push({id:uid(),name:val('supplierName'),phone:val('supplierPhone'),address:val('supplierAddress')}); save(); e.target.reset(); render(); toast('Supplier saved'); };
window.deleteCustomer=id=>{ if(confirm('Delete customer?')){ remove(db.customers,id); save(); render(); }};
window.deleteSupplier=id=>{ if(confirm('Delete supplier?')){ remove(db.suppliers,id); save(); render(); }};
$('reportFilter').onsubmit=e=>{ e.preventDefault(); renderReports(); };
$('exportCsv').onclick=()=>{
  const rows=[['Date','Sales','Received Items','Expenses','Gross Profit','Net Profit/Loss','Total Amount']];
  document.querySelectorAll('#reportTable tr').forEach(tr=>{ const cols=[...tr.children].map(td=>td.textContent); if(cols.length===7 && cols[0]!=='No report data.') rows.push(cols); });
  download('depot_report.csv', rows.map(r=>r.map(x=>`"${String(x).replaceAll('"','""')}"`).join(',')).join('\n'), 'text/csv');
};
$('downloadBackup').onclick=()=>download('depot_backup.json', JSON.stringify(db,null,2), 'application/json');
$('restoreBackup').onchange=e=>{ const file=e.target.files[0]; if(!file)return; const reader=new FileReader(); reader.onload=()=>{ try{ db=JSON.parse(reader.result); save(); render(); toast('Backup restored'); }catch{ toast('Invalid backup file'); } }; reader.readAsText(file); };
$('resetSystem').onclick=()=>{ if(confirm('Reset all data?')){ localStorage.removeItem(KEY); db=load(); render(); }};
$('printBtn').onclick=()=>print();
$('seedBtn').onclick=()=>{ seed(); save(); render(); toast('Demo data loaded'); };
function download(name, content, type){ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([content],{type})); a.download=name; a.click(); URL.revokeObjectURL(a.href); }
function setDates(){ ['receiveDate','saleDate','expenseDate'].forEach(id=>$(id).value=today()); }
function seed(){
  db={ items:[{id:'i1',name:'Cement',unit:'bag',qty:100,cost:30000,retail:37000,wholesale:35000,alert:10},{id:'i2',name:'Sugar',unit:'kg',qty:50,cost:3500,retail:4500,wholesale:4200,alert:8},{id:'i3',name:'Cooking Oil',unit:'litre',qty:30,cost:6500,retail:8000,wholesale:7600,alert:5}], customers:[{id:'walkin',name:'Walk-in Customer',phone:'',address:''},{id:'c1',name:'Mukasa Shop',phone:'0700000000',address:'Kampala'}], suppliers:[{id:'unknown',name:'Unknown Supplier',phone:'',address:''},{id:'s1',name:'Depot Wholesalers',phone:'0750000000',address:'Industrial Area'}], received:[], sales:[], expenses:[] };
  db.received.push({id:'r1',date:today(),supplierId:'s1',itemId:'i1',qty:20,unitCost:30000,notes:''});
  db.sales.push({id:'sl1',date:today(),customerId:'walkin',itemId:'i1',qty:5,price:37000,cost:30000,priceType:'retail',payment:'Cash'});
  db.expenses.push({id:'e1',date:today(),category:'Transport',desc:'Delivery fuel',amount:20000});
}
setDates(); route();
