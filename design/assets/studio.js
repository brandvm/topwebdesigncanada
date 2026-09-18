const buttons=[...document.querySelectorAll('[data-filter]')];
const references=[...document.querySelectorAll('[data-category]')];
for(const button of buttons)button.addEventListener('click',()=>{
 const group=button.dataset.filter;
 for(const other of buttons)other.setAttribute('aria-pressed',String(other===button));
 let visible=0;
 for(const reference of references){reference.hidden=group!=='All references'&&reference.dataset.category!==group;if(!reference.hidden)visible++;}
 document.getElementById('reference-count').textContent=`${visible} references`;
});
