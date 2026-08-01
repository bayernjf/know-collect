import Modal from './Modal';
import { useStore } from '../store';
import type { Report } from '../types';
import { reportToMarkdown, reportToPrintHTML, downloadFile } from '../lib/export';

interface ReportModalProps {
  report: Report;
  onClose: () => void;
}

export default function ReportModal({ report, onClose }: ReportModalProps) {
  const { deleteReport, showToast } = useStore();

  const copy = () => {
    navigator.clipboard.writeText(report.content);
    showToast('已复制报告内容');
  };

  const exportMarkdown = () => {
    const md = reportToMarkdown(report);
    const filename = `${report.title.replace(/[\s/\\]/g, '_')}.md`;
    downloadFile(md, filename, 'text/markdown;charset=utf-8');
    showToast('Markdown 已导出');
  };

  const exportPDF = () => {
    const html = reportToPrintHTML(report);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
    } else {
      showToast('请允许弹窗以导出 PDF', true);
    }
  };

  const handleDelete = () => {
    if (confirm('确定删除这份报告吗？')) {
      deleteReport(report.id);
      onClose();
    }
  };

  return (
    <Modal onClose={onClose} className="report-modal">
      <h2>{report.title}</h2>
      <div className="report-stats">
        <span>📊 {report.videoCount} 个视频</span>
        <span>🗂️ {report.platforms.join('、')}</span>
        <span>🕒 {report.date}</span>
      </div>
      {report.tags.length > 0 && (
        <div className="report-tags">
          {report.tags.map((t) => (
            <span key={t} className="tag">
              #{t}
            </span>
          ))}
        </div>
      )}
      <div className="report-body">
        <pre>{report.content}</pre>
      </div>
      <div className="form-actions">
        <button className="btn btn-outline" onClick={copy}>
          📋 复制报告
        </button>
        <button className="btn btn-outline" onClick={exportMarkdown}>
          📄 导出 MD
        </button>
        <button className="btn btn-outline" onClick={exportPDF}>
          📑 导出 PDF
        </button>
        <button className="btn btn-danger btn-sm" onClick={handleDelete}>
          🗑️ 删除
        </button>
        <button className="btn btn-outline" onClick={onClose}>
          关闭
        </button>
      </div>
    </Modal>
  );
}
