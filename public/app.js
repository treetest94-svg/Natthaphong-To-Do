const $=id=>document.getElementById(id);
let mode='login', tasks=[],filter='all',user=null;
function message(text){$('message').textContent=text;$('message').hidden=!text;}
async function api(path,method='GET',body){
 const response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:body!==undefined?{'Content-Type':'application/json'}:{},body:body!==undefined?JSON.stringify(body):undefined});
 const data=response.status===204?{}:await response.json();
 if(!response.ok){if(response.status===401 && user){user=null;showAuth();}throw new Error(data.error||'Please try again.');}
 return data;
}
function showAuth(){$('auth-view').hidden=false;$('tasks-view').hidden=true;$('logout').hidden=true;$('loading').hidden=true;$('username').focus();}
function setMode(next){mode=next;message('');$('login-tab').classList.toggle('selected',mode==='login');$('register-tab').classList.toggle('selected',mode==='register');$('login-tab').setAttribute('aria-pressed',mode==='login');$('register-tab').setAttribute('aria-pressed',mode==='register');$('auth-title').textContent=mode==='login'?'Welcome back.':'Make a little space.';$('auth-subtitle').textContent=mode==='login'?'Your next small step is waiting.':'Create your account and start your own list.';$('password').autocomplete=mode==='login'?'current-password':'new-password';$('auth-submit').textContent=mode==='login'?'Log in →':'Create account →';}
$('login-tab').addEventListener('click',()=>setMode('login'));
$('register-tab').addEventListener('click',()=>setMode('register'));
async function showTasks(){const data=await api('/tasks');tasks=data.tasks;$('user-name').textContent=user.username;$('auth-view').hidden=true;$('tasks-view').hidden=false;$('logout').hidden=false;$('loading').hidden=true;render();$('task-title').focus();}
$('auth-form').addEventListener('submit',async event=>{event.preventDefault();message('');$('auth-submit').disabled=true;try{const data=await api(`/${mode}`,'POST',{username:$('username').value,password:$('password').value});user=data.user;$('password').value='';await showTasks();}catch(error){message(error.message);}finally{$('auth-submit').disabled=false;}});
$('logout').addEventListener('click',async()=>{try{await api('/logout','POST',{});user=null;tasks=[];message('');showAuth();}catch(error){message(error.message);}});
$('task-form').addEventListener('submit',async event=>{event.preventDefault();message('');const title=$('task-title').value.trim();if(!title)return message('Write a task before adding it.');$('add-task').disabled=true;try{const data=await api('/tasks','POST',{title});tasks.unshift(data.task);$('task-title').value='';render();$('task-title').focus();}catch(error){message(error.message);}finally{$('add-task').disabled=false;}});
for(const button of document.querySelectorAll('[data-filter]'))button.addEventListener('click',()=>{filter=button.dataset.filter;for(const item of document.querySelectorAll('[data-filter]')){item.classList.toggle('selected',item===button);item.setAttribute('aria-pressed',item===button);}render();});
function render(){
 const done=tasks.filter(task=>task.completed).length;$('total-badge').textContent=tasks.length;$('progress-number').textContent=`${done} / ${tasks.length}`;$('progress').max=tasks.length||1;$('progress').value=done;$('remaining').textContent=`${tasks.length-done} remaining`;
 const visible=tasks.filter(task=>filter==='all'||(filter==='completed'?task.completed:!task.completed));$('task-list').replaceChildren();$('empty').hidden=visible.length>0;
 $('empty').querySelector('h3').textContent=tasks.length?'Nothing here for now.':'A fresh page.';$('empty').querySelector('p').textContent=tasks.length?'Try another filter, or add a new task.':'Add your first task. Small is a good place to start.';
 for(const task of visible){
  const row=document.createElement('li');row.className=`task-row${task.completed?' done':''}`;
  const label=document.createElement('label'),checkbox=document.createElement('input'),text=document.createElement('span'),remove=document.createElement('button');
  checkbox.type='checkbox';checkbox.checked=task.completed;checkbox.setAttribute('aria-label',`Mark ${task.title} ${task.completed?'active':'complete'}`);text.className='task-text';text.textContent=task.title;label.append(checkbox,text);
  remove.type='button';remove.className='delete';remove.textContent='×';remove.setAttribute('aria-label',`Delete ${task.title}`);row.append(label,remove);$('task-list').append(row);
  checkbox.addEventListener('change',async()=>{checkbox.disabled=true;message('');try{const data=await api(`/tasks/${task.id}`,'PATCH',{completed:checkbox.checked});tasks=tasks.map(item=>item.id===task.id?data.task:item);render();}catch(error){checkbox.checked=task.completed;checkbox.disabled=false;message(error.message);}});
  remove.addEventListener('click',async()=>{remove.disabled=true;message('');try{await api(`/tasks/${task.id}`,'DELETE',{});tasks=tasks.filter(item=>item.id!==task.id);render();}catch(error){remove.disabled=false;message(error.message);}});
 }
}
(async()=>{try{const data=await api('/me');user=data.user;await showTasks();}catch(error){showAuth();if(error.message!=='Please log in.')message(error.message);}})();
