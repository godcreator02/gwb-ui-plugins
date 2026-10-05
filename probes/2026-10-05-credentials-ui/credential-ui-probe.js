() => ({
  text: document.body.innerText.split('\n').filter((line) => /base-url|push-url|token|已设置|没设过|未设置|保存|清空|隐|虚假|ui-credential/.test(line)).slice(0, 35),
  inputs: [...document.querySelectorAll('input,textarea')].map((node) => ({tag: node.tagName, type: node.type, placeholder: node.placeholder, valuePresent: node.value !== '', id: node.id})),
  buttons: [...document.querySelectorAll('button')].filter((node) => /查看|隐藏|保存|放弃/.test(node.innerText + node.title)).map((node) => ({text: node.innerText, title: node.title, label: node.getAttribute('aria-label')})),
})
