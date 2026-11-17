import { ErrorActionsContext } from '@/api/error-actions';
import type { Harness } from '../types';
import { Banner, FieldLine, Inline, Kept, Row } from './states';

/** One error-notice state, chosen by the scenario's `state`. Where an error's
 *  button would leave the view, the handoff is logged and nothing moves. */
export function ErrorNoticeStage({ harness }: { harness: Harness }) {
  const state = harness.props.state as string;
  return (
    <ErrorActionsContext
      value={(action) => {
        harness.handoff({
          to: action === 'open_settings' ? 'Settings' : 'Elsewhere',
          what: action,
        });
      }}
    >
      <div className="p-card">
        {state === 'inline' && <Inline harness={harness} />}
        {state === 'row' && <Row harness={harness} />}
        {state === 'banner' && <Banner harness={harness} />}
        {state === 'field' && <FieldLine />}
        {state === 'settings' && <Kept />}
      </div>
    </ErrorActionsContext>
  );
}
