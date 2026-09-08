// Construction decisions use a native modal so keyboard and touch follow the
// same explicit accept/cancel path. Esc is a decline, never implicit consent.
export function constructionDialog({title,message,acceptLabel='Build',cancelLabel='Cancel',accept,cancel=()=>{}}) {
  const dialog=document.createElement('dialog'); dialog.setAttribute('aria-label',title);
  const header=document.createElement('div');header.className='modal-header';header.textContent=title;
  const body=document.createElement('div');body.className='modal-body';body.textContent=message;
  const footer=document.createElement('div');footer.className='modal-footer';
  let accepted=false;
  for(const [label,yes] of [[cancelLabel,false],[acceptLabel,true]]) {
    const button=document.createElement('button');button.className=yes?'btn btn-teal':'btn';button.textContent=label;
    button.addEventListener('click',()=>{accepted=yes;dialog.close();});footer.append(button);
  }
  dialog.append(header,body,footer);document.body.append(dialog);
  dialog.addEventListener('close',()=>{dialog.remove();if(accepted)accept();else cancel();},{once:true});
  dialog.showModal(); footer.lastElementChild.focus();
  return dialog;
}
