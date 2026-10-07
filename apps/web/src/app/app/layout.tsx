import { Shell } from '@/components/shell';
import { WorkspaceAccess } from '@/components/workspace-access';
export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <WorkspaceAccess>
      <Shell>{children}</Shell>
    </WorkspaceAccess>
  );
}
