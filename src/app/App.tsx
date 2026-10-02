import { nativeExportPdf } from '../infrastructure/nativeExportPdf';
import {
  nativeExportAssessment,
  nativePublicationPreview,
} from '../infrastructure/nativePublication';
import { localShortcutRegistry } from '../application/shortcuts';
import { localViewPreferences } from '../application/viewPreferences';
import { PresentationControls } from './PresentationControls';
import { useEffect, useMemo, useState } from 'react';
import type { AppInfoPort, AppInfoResult } from '../application/appInfo';
import { Home } from './Home';
import { nativeRecentProjects } from '../infrastructure/nativeRecentProjects';
import type { RecentProjectsPort } from '../application/recentProjects';
import {
  unavailableRecovery,
  type RecoveryPort,
} from '../application/startupRecovery';
import { nativeRecovery } from '../infrastructure/nativeRecovery';
import { nativeDocumentEntry } from '../infrastructure/nativeDocumentEntry';
import { nativeDocuments } from '../infrastructure/nativeDocuments';
import { nativeSaveAs } from '../infrastructure/nativeSaveAs';
import { nativeSnapshots } from '../infrastructure/nativeSnapshots';
import { nativeRecoveryChoices } from '../infrastructure/nativeRecoveryChoices';
import { nativeFountainImport } from '../infrastructure/nativeFountainImport';
import { nativeWorkflowProtection } from '../infrastructure/nativeWorkflowProtection';
import { browserAppInfo } from '../infrastructure/browserAppInfo';
import { nativeAppInfo } from '../infrastructure/nativeAppInfo';
import {
  WritingView,
  type OpenRequest,
  type WritingPorts,
} from './WritingView';

const defaultPort =
  '__TAURI_INTERNALS__' in window ? nativeAppInfo : browserAppInfo;

const defaultRecovery =
  '__TAURI_INTERNALS__' in window ? nativeRecovery : unavailableRecovery;

const writingPorts = {
  entry: nativeDocumentEntry,
  documents: nativeDocuments,
  saveAs: nativeSaveAs,
  snapshots: nativeSnapshots,
  choices: nativeRecoveryChoices,
  recovery: nativeRecovery,
  fountainImport: nativeFountainImport,
  workflows: nativeWorkflowProtection,
  exportAssessment: nativeExportAssessment,
  publication: nativePublicationPreview,
  exportPdf: nativeExportPdf,
};

export function App({
  appInfo = defaultPort,
  recovery = defaultRecovery,
  ports = writingPorts,
  recents = nativeRecentProjects,
}: {
  appInfo?: AppInfoPort;
  recovery?: Pick<RecoveryPort, 'list' | 'preview'>;
  ports?: WritingPorts;
  recents?: RecentProjectsPort;
}) {
  const registry = useMemo(
    () =>
      localShortcutRegistry(/Mac/.test(navigator.platform) ? 'mac' : 'other'),
    [],
  );
  const preferences = useMemo(() => localViewPreferences(), []);
  const [result, setResult] = useState<AppInfoResult | null>(null);
  const [homeMessage, setHomeMessage] = useState('');
  const [open, setOpen] = useState<OpenRequest | null>(null);
  const [openSequence, setOpenSequence] = useState(0);
  const native = '__TAURI_INTERNALS__' in window;

  useEffect(() => {
    let active = true;
    void appInfo
      .getAppInfo()
      .then((value) => {
        if (active) setResult(value);
      })
      .catch(() => {
        if (active)
          setResult({
            status: 'unavailable',
            reason: 'Native app information could not be read.',
          });
      });
    return () => {
      active = false;
    };
  }, [appInfo]);

  if (open && native)
    return (
      <WritingView
        registry={registry}
        preferences={preferences}
        ports={ports}
        recents={recents}
        open={open}
        onSessionClosed={(message) => {
          setHomeMessage(
            message ??
              'Session closed. Source saving and recovery retain their confirmed versions.',
          );
          setOpen(null);
        }}
        onOpenRequested={() => {
          setOpenSequence((n) => n + 1);
          setOpen({ kind: 'picked' });
        }}
        key={openSequence}
      />
    );

  return (
    <>
      <div className="home-presentation">
        <PresentationControls preferences={preferences} />
      </div>
      <Home
        registry={registry}
        native={native}
        result={result}
        recents={recents}
        recovery={recovery}
        message={homeMessage}
        onOpen={(request) => {
          setHomeMessage('');
          setOpen(request);
        }}
      />
    </>
  );
}
