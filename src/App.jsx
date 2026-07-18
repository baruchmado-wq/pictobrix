import Editor from './components/Editor.jsx'

// /kit (or #kit) is the dedicated retail-kit flow reached from the QR code on
// the box — completely separate from the classic editor.
const isKit =
  window.location.pathname.replace(/\/+$/, '') === '/kit' ||
  window.location.hash === '#kit'

export default function App() {
  return <Editor key={isKit ? 'kit' : 'classic'} kit={isKit} />
}
