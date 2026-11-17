const menuButton=document.querySelector('.menu-toggle');
const navigation=document.getElementById('nav');
function setMenu(open){navigation?.classList.toggle('active',open);menuButton?.setAttribute('aria-expanded',String(open));}
function toggleMenu(){setMenu(!navigation?.classList.contains('active'));}
document.querySelectorAll('#nav a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false);});
document.addEventListener('click',e=>{if(!e.target.closest('header'))setMenu(false);});
const contactDialog=document.getElementById('contactOptions');
document.querySelector('.whatsapp-float')?.addEventListener('click',()=>contactDialog?.showModal());
document.querySelector('.dialog-close')?.addEventListener('click',()=>contactDialog?.close());
contactDialog?.addEventListener('click',e=>{if(e.target===contactDialog)contactDialog.close();});
