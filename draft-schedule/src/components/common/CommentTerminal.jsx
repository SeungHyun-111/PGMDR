import { useEffect, useRef } from 'react'
import { Compartment, EditorState, StateField, Transaction } from '@codemirror/state'
import { Decoration, EditorView, keymap, placeholder } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, insertNewline } from '@codemirror/commands'
import './CommentTerminal.css'

// Plain memo text stays plain text in storage. Decorations only color the view.
const tokenPattern = /(?<annotation>\([^\n)]*\)|（[^\n）]*）)|(?<date>\d{4}[./-]\d{1,2}[./-]\d{1,2}|\d{1,2}[./]\d{1,2}(?!\d)|\d{1,2}\s*월(?:\s*\d{1,2}\s*일)?|\d{1,2}\s*일)|(?<rank>\d+\s*위)|(?<percentage>\d+(?:\.\d+)?\s*%)|(?<team>[가-힣A-Za-z]+팀|헬스푸드|문화서비스|패션|무형|뷰티|가전|리빙|식품|건강식품)|(?<operator>[→↳❯├└─▶⇒➜]|->)|(?<number>\d[\d,]*(?:\.\d+)?)/g

function colorize(state) {
  const ranges = []
  const text = state.doc.toString()
  for (const match of text.matchAll(tokenPattern)) {
    const kind = Object.keys(match.groups).find(key => match.groups[key] !== undefined)
    ranges.push(Decoration.mark({ class: `comment-token-${kind}` }).range(match.index, match.index + match[0].length))
  }
  return Decoration.set(ranges)
}
const commentColors = StateField.define({
  create: colorize,
  update: (decorations, transaction) => transaction.docChanged ? colorize(transaction.state) : decorations,
  provide: field => EditorView.decorations.from(field),
})
const terminalTheme = EditorView.theme({
  '&': { backgroundColor: 'transparent', color: '#dce7f5', fontSize: '13px' },
  '.cm-scroller': { fontFamily: '"JetBrains Mono", "Cascadia Code", Consolas, "Malgun Gothic", monospace', lineHeight: '1.8', overflow: 'auto' },
  '.cm-content': { padding: '14px 18px', minHeight: '115px', caretColor: '#86baff' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: '#86baff' },
  '&.cm-focused': { outline: 'none' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: '#548ad64d' },
  '.cm-placeholder': { color: '#adbed5' },
}, { dark: true })

export default function CommentTerminal({ id, value, disabled, onChange, onBlur, status, failed, onRetry }) {
  const host = useRef(null)
  const view = useRef(null)
  const callbacks = useRef({ onChange, onBlur })
  const initial = useRef({ value, disabled, id })
  const editable = useRef(new Compartment())
  const externalUpdate = useRef(false)
  useEffect(() => { callbacks.current = { onChange, onBlur } }, [onChange, onBlur])
  useEffect(() => {
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: initial.current.value, extensions: [
        terminalTheme, commentColors, history(), keymap.of([{ key: 'Enter', run: insertNewline }, ...defaultKeymap, ...historyKeymap]), EditorView.lineWrapping,
        placeholder('담당자 코멘트를 작성해주세요.'),
        EditorView.contentAttributes.of({ id: initial.current.id, 'aria-label': '담당자 코멘트 내용', 'aria-multiline': 'true', spellcheck: 'false' }),
        editable.current.of([EditorView.editable.of(!initial.current.disabled), EditorState.readOnly.of(initial.current.disabled)]),
        EditorView.updateListener.of(update => {
          if (update.docChanged && !externalUpdate.current) callbacks.current.onChange(update.state.doc.toString())
        }),
        EditorView.domEventHandlers({ blur: () => { callbacks.current.onBlur(); return false } }),
      ] }),
    })
    view.current = editor
    return () => { view.current = null; editor.destroy() }
  }, [])
  useEffect(() => {
    const editor = view.current
    if (editor && editor.state.doc.toString() !== value) {
      externalUpdate.current = true
      try { editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: value }, annotations: Transaction.addToHistory.of(false) }) }
      finally { externalUpdate.current = false }
    }
  }, [value])
  useEffect(() => {
    view.current?.dispatch({ effects: editable.current.reconfigure([EditorView.editable.of(!disabled), EditorState.readOnly.of(disabled)]) })
  }, [disabled])
  return <div className="comment-terminal" aria-disabled={disabled}>
    <div className="comment-terminal-bar"><span><i /> 담당자 코멘트 <em>COMMENT TERMINAL</em></span><div className="comment-terminal-status"><small role={failed ? 'alert' : 'status'}>{status || (disabled ? 'READ ONLY' : '자동 저장')}</small>{failed && <button type="button" onClick={onRetry}>다시 시도</button>}</div></div>
    <div ref={host} />
    <div className="comment-terminal-prompt" aria-hidden="true">manager@pgmdr <span>❯</span><i /></div>
  </div>
}
