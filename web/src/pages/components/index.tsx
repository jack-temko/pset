import { Navigate, useParams, useSearchParams } from 'react-router-dom'

import { SegmentedControl } from '@/components/segmented-control'
import { GalleryShell } from '@/pages/gallery/shell'
import { Docs } from './docs'
import { withDocs } from './readmes'
import { SECTIONS } from './sections'

/**
 * Every component and every variant, one section at a time, in the app
 * itself.
 *
 * Not in the nav and not part of the product's three screens: it is the
 * page you open to see what a change did. Add a section here the moment
 * you build a component (a group file in `sections/`); anything missing
 * from this page is unreviewed. A section whose component has a README
 * shows it under Docs, at `?view=docs`.
 */
export function Components() {
  const { section } = useParams()
  const [params, setParams] = useSearchParams()
  const entry = SECTIONS.find((s) => s.id === section)
  // A bare /components, or a section that isn't there, opens the first.
  if (!entry) return <Navigate to={`/components/${SECTIONS[0].id}`} replace />

  const docs = withDocs(entry.docs)
  const showDocs = docs.length > 0 && params.get('view') === 'docs'
  const { Demo } = entry
  return (
    <GalleryShell
      label="Components"
      basePath="/components"
      entries={SECTIONS}
      entry={entry}
      toolbar={
        docs.length > 0 && (
          <SegmentedControl
            label="Show"
            value={showDocs ? 'docs' : 'demo'}
            onChange={(v) => setParams(v === 'docs' ? { view: 'docs' } : {}, { replace: true })}
            options={[
              { value: 'demo', label: 'Demo' },
              { value: 'docs', label: 'Docs' },
            ]}
          />
        )
      }
    >
      {showDocs ? (
        <Docs names={docs} />
      ) : (
        <div className="space-y-6">
          <Demo />
        </div>
      )}
    </GalleryShell>
  )
}
