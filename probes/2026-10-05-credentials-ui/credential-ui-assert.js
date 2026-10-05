() => ({
  fakeSecretShownLocally: [...document.querySelectorAll('input')].some((node) => node.type === 'text' && node.value === 'fake-ui-credential-20261005'),
  fakeSecretInBodyText: document.body.innerText.includes('fake-ui-credential-20261005'),
  unsaved: document.body.innerText.includes('还没保存'),
  hiddenPlaceholder: [...document.querySelectorAll('input')].some((node) => node.type === 'password' && node.value === '' && node.placeholder.startsWith('已设置')),
})
