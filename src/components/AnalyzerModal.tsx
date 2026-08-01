import { useEffect, useState } from 'react';
import Modal from './Modal';
import { sleep } from '../utils';

interface AnalyzerModalProps {
  title: string;
  steps: string[];
  onComplete: () => void;
}

/** 模拟 AI 分析进度的弹窗，逐条展示步骤后回调 onComplete */
export default function AnalyzerModal({
  title,
  steps,
  onComplete,
}: AnalyzerModalProps) {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState(steps[0] ?? '准备中...');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (let i = 0; i < steps.length; i++) {
        if (cancelled) return;
        setStatus(steps[i]);
        setProgress((i / steps.length) * 100);
        await sleep(450);
      }
      if (cancelled) return;
      setProgress(100);
      await sleep(250);
      onComplete();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal onClose={() => {}} closeOnOverlay={false}>
      <h2>{title}</h2>
      <div className="analyzer-status">{status}</div>
      <div className="ai-thinking">
        <div className="ai-dots">
          <span></span>
          <span></span>
          <span></span>
        </div>
        <span>AI 引擎处理中...</span>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: progress + '%' }}></div>
      </div>
    </Modal>
  );
}
