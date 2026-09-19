(function(){
  const parts=window.__DOMINO_SPRITE_PARTS||[];
  const data='data:image/webp;base64,'+parts.join('');
  document.documentElement.style.setProperty('--domino-sprite',`url("${data}")`);
})();
