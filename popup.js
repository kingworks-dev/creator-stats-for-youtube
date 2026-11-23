const $ = id => document.getElementById(id);
$('buy').href = 'https://buy.stripe.com/4gM7sE8HB0q0afM9aH0x41B';
function msg(t, err) { $('msg').textContent = t; $('msg').className = err ? 'err' : ''; }
async function render() { const p = await isPro(); $('plan').textContent = p ? 'Pro' : 'Free'; $('plan').className = 'badge' + (p ? ' pro' : ''); }
$('activate').onclick = async () => {
  const k = $('key').value.trim().toUpperCase();
  if (await validKey(k)) { await api.storage.local.set({ proKey: k }); msg('Pro unlocked. Thank you.'); } else msg('That key is not valid.', 1); render();
};
render();
