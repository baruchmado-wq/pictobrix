import Editor from './components/Editor.jsx'
import { SharedBuild } from './components/AssemblyView.jsx'
import { decodeBoardShare } from './lib/share.js'

// /kit (or #kit) is the dedicated retail-kit flow reached from the QR code on
// the box. A "#bld=..." hash is a shared-board link (family building together):
// the whole board is encoded in the link and opens straight into assembly.
const sharedBoard = decodeBoardShare(window.location.hash)
const isKit =
  window.location.pathname.replace(/\/+$/, '') === '/kit' ||
  window.location.hash === '#kit'

export default function App() {
  if (sharedBoard) return <SharedBuild shared={sharedBoard} />
  return <Editor key={isKit ? 'kit' : 'classic'} kit={isKit} />
}
