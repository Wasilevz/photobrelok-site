// Подстраховка для старых Safari/WebKit (Telegram на старом macOS показывает мини-приложение системным WebKit).
// 1) Мелкие полифилы того, что Next.js использует без своих полифилов.
// 2) На /crm: если скрипт страницы упал — показать текст ошибки вместо вечного «Загружаем заказы…».
// Простой ES5 без зависимостей: выполняется до бандлов Next.
export const LEGACY_SCRIPT = `(function(){
try{
if(typeof window.structuredClone!=="function"){window.structuredClone=function(v){return v===undefined?undefined:JSON.parse(JSON.stringify(v));};}
if(window.AbortSignal&&typeof AbortSignal.timeout!=="function"&&typeof AbortController==="function"){AbortSignal.timeout=function(ms){var c=new AbortController();setTimeout(function(){c.abort();},ms);return c.signal;};}
}catch(e){}
if(location.pathname.indexOf("/crm")!==0)return;
function show(msg){if(window.__crmMounted)return;try{var d=document.getElementById("crm-fatal");if(!d){d=document.createElement("div");d.id="crm-fatal";d.style.cssText="position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;background:#fff;border:2px solid #B42318;border-radius:12px;padding:12px;font:14px/1.4 -apple-system,sans-serif;color:#191715";(document.body||document.documentElement).appendChild(d);}d.textContent="CRM не запустилась на этом устройстве. Пришлите скриншот: "+msg+" | "+navigator.userAgent;}catch(e){}}
window.addEventListener("error",function(e){show((e&&e.message)||"ошибка скрипта");});
setTimeout(function(){if(!window.__crmMounted)show("страница не запустилась за 8 секунд");},8000);
window.addEventListener("unhandledrejection",function(e){var r=e&&e.reason;show("promise: "+((r&&r.message)||r));});
})();`;
