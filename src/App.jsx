import Editor from './components/Editor.jsx'
import Gate from './components/Gate.jsx'
import { SharedBuild } from './components/AssemblyView.jsx'
import { decodeBoardShare } from './lib/share.js'

// /kit (or #kit) is the dedicated retail-kit flow reached from the QR code on
// the box. A "?b=..." link (family building together) encodes a whole board and
// opens straight into assembly.
const sharedBoard = decodeBoardShare()
const isKit =
  window.location.pathname.replace(/\/+$/, '') === '/kit' ||
  window.location.hash === '#kit'

export default function App() {
  // customers (kit flow + shared assembly links) are never gated
  if (sharedBoard) return <SharedBuild shared={sharedBoard} />
  if (isKit) return <Editor key="kit" kit />
  // the classic pro app sits behind a soft password gate
  return (
    <Gate>
      <Editor key="classic" kit={false} />
    </Gate>
  )
}
