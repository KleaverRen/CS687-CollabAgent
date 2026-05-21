import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Bot,
  Check,
  FileText,
  ClipboardList,
  MessageSquareText,
  Send,
  Sparkles,
  Upload,
  Users,
} from 'lucide-react';
import clsx from 'clsx';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import api from '../utils/api';
import ReactMarkdown from 'react-markdown';

const tabs = [
  { id: 'rag', label: 'Document Q&A', icon: MessageSquareText },
  { id: 'task', label: 'Task Draft', icon: ClipboardList },
  { id: 'meeting', label: 'Meeting Notes', icon: Users },
  { id: 'feedback', label: 'Feedback', icon: FileText },
  { id: 'progress', label: 'Progress Report', icon: Sparkles },
];

const buttonBase = 'inline-flex h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton = `${buttonBase} bg-[#003fb1] text-white hover:bg-[#1353d8]`;
const secondaryButton = `${buttonBase} border border-[#c3c5d7] bg-white text-[#191c1d] hover:bg-[#f3f4f5]`;
const fieldClass = 'w-full rounded-lg border border-[#c3c5d7] bg-white px-3 py-2.5 text-sm text-[#191c1d] outline-none transition-all focus:border-[#003fb1] focus:ring-2 focus:ring-[#003fb1]/20';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-[#555f6d]';

function ResultBlock({ title, children }) {
  if (!children) return null;
  return (
    <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-4')}>
      <h3 className={clsx('mb-3', 'text-sm', 'font-bold', 'text-[#191c1d]')}>{title}</h3>
      {children}
    </section>
  );
}

function LoadingText({ loading, idle }) {
  return (
    <span className={clsx('text-sm', 'text-[#737686]')}>
      {loading ? 'Running model...' : idle}
    </span>
  );
}

export default function AIWorkbench() {
  const { id: projectId } = useParams();
  const [activeTab, setActiveTab] = useState('rag');
  const [loadingAction, setLoadingAction] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('auto');

  const [docTitle, setDocTitle] = useState('');
  const [docContent, setDocContent] = useState('');
  const [ragQuery, setRagQuery] = useState('');
  const [ragAnswer, setRagAnswer] = useState(null);

  const [taskRequest, setTaskRequest] = useState('');
  const [taskDraft, setTaskDraft] = useState(null);

  const [transcript, setTranscript] = useState('');
  const [meetingResult, setMeetingResult] = useState(null);

  const [feedbackBody, setFeedbackBody] = useState('');
  const [feedbackSeverity, setFeedbackSeverity] = useState('medium');
  const [feedbackResult, setFeedbackResult] = useState(null);

  const [progressReport, setProgressReport] = useState('');
  const [isEditingReport, setIsEditingReport] = useState(false);

  const activeLabel = useMemo(() => tabs.find(tab => tab.id === activeTab)?.label || 'AI', [activeTab]);

  const runAction = async (key, action) => {
    setLoadingAction(key);
    try {
      await action();
    } catch (err) {
      toast.error(err.response?.data?.error || 'AI request failed.');
    } finally {
      setLoadingAction('');
    }
  };

  const ingestDocument = () => runAction('ingest', async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast.error('Add a document title and content first.');
      return;
    }
    await api.post('/agents/rag/ingest', {
      title: docTitle,
      content: docContent,
      projectId,
    });
    setDocTitle('');
    setDocContent('');
    toast.success('Document queued for indexing.');
  });

  const askDocuments = () => runAction('rag', async () => {
    if (!ragQuery.trim()) {
      toast.error('Enter a question first.');
      return;
    }
    const { data } = await api.post('/agents/rag/query', {
      query: ragQuery,
      projectId,
      limit: 3,
      provider: selectedProvider === 'auto' ? null : selectedProvider
    });
    setRagAnswer(data);
  });

  const parseTask = () => runAction('task', async () => {
    if (!taskRequest.trim()) {
      toast.error('Describe the task first.');
      return;
    }
    const { data } = await api.post('/agents/task/parse', {
      request: taskRequest,
      projectId,
      provider: selectedProvider === 'auto' ? null : selectedProvider
    });
    setTaskDraft(data.draft);
  });

  const confirmTask = (draft) => runAction('confirm-task', async () => {
    await api.post('/agents/task/confirm', {
      draft,
      projectId,
      user_confirmed: true,
    });
    toast.success('Task created.');
  });

  const summarizeMeeting = () => runAction('meeting', async () => {
    if (!transcript.trim()) {
      toast.error('Paste meeting notes first.');
      return;
    }
    const { data } = await api.post('/agents/coordination/meeting', {
      transcript,
      projectId,
      provider: selectedProvider === 'auto' ? null : selectedProvider
    });
    setMeetingResult(data);
  });

  const submitFeedback = () => runAction('feedback', async () => {
    if (!feedbackBody.trim()) {
      toast.error('Add feedback text first.');
      return;
    }
    const { data } = await api.post('/agents/feedback/submit', {
      projectId,
      body: feedbackBody,
      severity: feedbackSeverity,
      category: 'general',
      provider: selectedProvider === 'auto' ? null : selectedProvider
    });
    setFeedbackResult(data);
    toast.success('Feedback recorded.');
  });

  const generateProgressReport = () => runAction('progress', async () => {
    const { data } = await api.get(`/agents/progress/report?projectId=${projectId}&provider=${selectedProvider === 'auto' ? '' : selectedProvider}`);
    setProgressReport(data.report);
  });

  const renderRag = () => (
    <div className={clsx('grid', 'gap-5', 'lg:grid-cols-[0.9fr_1.1fr]')}>
      <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
        <div className={clsx('mb-4', 'flex', 'items-center', 'gap-2')}>
          <Upload className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
          <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Index Project Document</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Document Title</label>
            <input className={fieldClass} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="SAML setup notes" />
          </div>
          <div>
            <label className={labelClass}>Document Content</label>
            <textarea className={`${fieldClass} min-h-44 resize-y`} value={docContent} onChange={(e) => setDocContent(e.target.value)} placeholder="Paste project documentation here." />
          </div>
          <button className={secondaryButton} disabled={loadingAction === 'ingest'} onClick={ingestDocument}>
            <Upload className={clsx('h-4', 'w-4')} />
            Queue Indexing
          </button>
        </div>
      </section>

      <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
        <div className={clsx('mb-4', 'flex', 'items-center', 'gap-2')}>
          <MessageSquareText className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
          <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Ask Indexed Documents</h2>
        </div>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Question</label>
            <textarea className={`${fieldClass} min-h-28 resize-y`} value={ragQuery} onChange={(e) => setRagQuery(e.target.value)} placeholder="What does our project documentation say about SSO?" />
          </div>
          <button className={primaryButton} disabled={loadingAction === 'rag'} onClick={askDocuments}>
            <Send className={clsx('h-4', 'w-4')} />
            Ask Model
          </button>
          <ResultBlock title="Answer">
            {ragAnswer ? (
              <div className="space-y-4">
                <p className={clsx('whitespace-pre-wrap', 'text-sm', 'leading-6', 'text-[#191c1d]')}>{ragAnswer.answer}</p>
                {ragAnswer.sources?.length > 0 && (
                  <div className="space-y-2">
                    <p className={clsx('text-xs', 'font-bold', 'uppercase', 'tracking-wide', 'text-[#737686]')}>Sources</p>
                    {ragAnswer.sources.map((source) => (
                      <div key={source.chunkId} className={clsx('rounded-lg', 'bg-[#f3f4f5]', 'p-3', 'text-xs', 'text-[#434654]')}>
                        <div className={clsx('font-semibold', 'text-[#191c1d]')}>{source.documentTitle}</div>
                        <div className="mt-1">{source.snippet}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <LoadingText loading={loadingAction === 'rag'} idle="No answer yet." />
            )}
          </ResultBlock>
        </div>
      </section>
    </div>
  );

  const renderTask = () => (
    <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
      <div className={clsx('mb-4', 'flex', 'items-center', 'gap-2')}>
        <ClipboardList className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
        <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Draft a Task</h2>
      </div>
      <div className={clsx('grid', 'gap-5', 'lg:grid-cols-[1fr_0.9fr]')}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Natural Language Request</label>
            <textarea className={`${fieldClass} min-h-40 resize-y`} value={taskRequest} onChange={(e) => setTaskRequest(e.target.value)} placeholder="Ask Maya to fix the login redirect bug by Friday. It is urgent." />
          </div>
          <button className={primaryButton} disabled={loadingAction === 'task'} onClick={parseTask}>
            <Sparkles className={clsx('h-4', 'w-4')} />
            Draft Task
          </button>
        </div>
        <ResultBlock title="Draft">
          {taskDraft ? (
            <div className="space-y-3">
              <dl className={clsx('grid', 'gap-3', 'text-sm')}>
                <div><dt className={clsx('text-xs', 'font-bold', 'uppercase', 'text-[#737686]')}>Title</dt><dd className={clsx('mt-1', 'text-[#191c1d]')}>{taskDraft.title}</dd></div>
                <div><dt className={clsx('text-xs', 'font-bold', 'uppercase', 'text-[#737686]')}>Priority</dt><dd className={clsx('mt-1', 'capitalize', 'text-[#191c1d]')}>{taskDraft.priority}</dd></div>
                <div><dt className={clsx('text-xs', 'font-bold', 'uppercase', 'text-[#737686]')}>Assignee</dt><dd className={clsx('mt-1', 'text-[#191c1d]')}>{taskDraft.assignee_name || 'Unassigned'}</dd></div>
              </dl>
              <button className={secondaryButton} disabled={loadingAction === 'confirm-task'} onClick={() => confirmTask(taskDraft)}>
                <Check className={clsx('h-4', 'w-4')} />
                Create Task
              </button>
            </div>
          ) : (
            <LoadingText loading={loadingAction === 'task'} idle="No draft yet." />
          )}
        </ResultBlock>
      </div>
    </section>
  );

  const renderMeeting = () => (
    <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
      <div className={clsx('mb-4', 'flex', 'items-center', 'gap-2')}>
        <Users className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
        <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Extract Meeting Actions</h2>
      </div>
      <div className={clsx('grid', 'gap-5', 'lg:grid-cols-[1fr_1fr]')}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Transcript</label>
            <textarea className={`${fieldClass} min-h-56 resize-y`} value={transcript} onChange={(e) => setTranscript(e.target.value)} placeholder="Paste meeting transcript or notes." />
          </div>
          <button className={primaryButton} disabled={loadingAction === 'meeting'} onClick={summarizeMeeting}>
            <Sparkles className={clsx('h-4', 'w-4')} />
            Extract Actions
          </button>
        </div>
        <ResultBlock title="Summary & Action Items">
          {meetingResult ? (
            <div className="space-y-4">
              <p className={clsx('text-sm', 'leading-6', 'text-[#191c1d]')}>{meetingResult.summary}</p>
              <div className="space-y-2">
                {meetingResult.actionItemDrafts?.map((item, index) => (
                  <div key={`${item.title}-${index}`} className={clsx('flex', 'flex-col', 'gap-3', 'rounded-lg', 'bg-[#f3f4f5]', 'p-3', 'sm:flex-row', 'sm:items-center', 'sm:justify-between')}>
                    <div>
                      <div className={clsx('text-sm', 'font-semibold', 'text-[#191c1d]')}>{item.title}</div>
                      <div className={clsx('text-xs', 'capitalize', 'text-[#737686]')}>{item.priority} priority · {item.assignee_name || 'Unassigned'}</div>
                    </div>
                    <button className={secondaryButton} disabled={loadingAction === 'confirm-task'} onClick={() => confirmTask(item)}>
                      <Check className={clsx('h-4', 'w-4')} />
                      Create
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <LoadingText loading={loadingAction === 'meeting'} idle="No summary yet." />
          )}
        </ResultBlock>
      </div>
    </section>
  );

  const renderFeedback = () => (
    <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
      <div className={clsx('mb-4', 'flex', 'items-center', 'gap-2')}>
        <FileText className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
        <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Analyze Advisor Feedback</h2>
      </div>
      <div className={clsx('grid', 'gap-5', 'lg:grid-cols-[1fr_0.9fr]')}>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Feedback</label>
            <textarea className={`${fieldClass} min-h-44 resize-y`} value={feedbackBody} onChange={(e) => setFeedbackBody(e.target.value)} placeholder="Paste advisor feedback for the team." />
          </div>
          <div>
            <label className={labelClass}>Severity</label>
            <select className={fieldClass} value={feedbackSeverity} onChange={(e) => setFeedbackSeverity(e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <button className={primaryButton} disabled={loadingAction === 'feedback'} onClick={submitFeedback}>
            <Send className={clsx('h-4', 'w-4')} />
            Submit & Analyze
          </button>
        </div>
        <ResultBlock title="Suggested Response">
          {feedbackResult ? (
            <div className="space-y-4">
              <div>
                <p className={clsx('text-xs', 'font-bold', 'uppercase', 'tracking-wide', 'text-[#737686]')}>Summary</p>
                <p className={clsx('mt-1', 'text-sm', 'leading-6', 'text-[#191c1d]')}>{feedbackResult.structuredSummary}</p>
              </div>
              <div>
                <p className={clsx('text-xs', 'font-bold', 'uppercase', 'tracking-wide', 'text-[#737686]')}>Template</p>
                <p className={clsx('mt-1', 'whitespace-pre-wrap', 'text-sm', 'leading-6', 'text-[#191c1d]')}>{feedbackResult.suggestedResponseTemplate}</p>
              </div>
            </div>
          ) : (
            <LoadingText loading={loadingAction === 'feedback'} idle="No feedback analysis yet." />
          )}
        </ResultBlock>
      </div>
    </section>
  );

  const renderProgress = () => (
    <section className={clsx('rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-white', 'p-5')}>
      <div className={clsx('mb-4', 'flex', 'flex-col', 'gap-3', 'sm:flex-row', 'sm:items-center', 'sm:justify-between')}>
        <div className={clsx('flex', 'items-center', 'gap-2')}>
          <Sparkles className={clsx('h-5', 'w-5', 'text-[#003fb1]')} />
          <h2 className={clsx('text-lg', 'font-bold', 'text-[#191c1d]')}>Generate Progress Report</h2>
        </div>
        <div className={clsx('flex', 'gap-2')}>
          {progressReport && (
            <button
              className={secondaryButton}
              onClick={() => setIsEditingReport(!isEditingReport)}
            >
              {isEditingReport ? 'View Preview' : 'Edit Report'}
            </button>
          )}
          <button className={primaryButton} disabled={loadingAction === 'progress'} onClick={generateProgressReport}>
            <Sparkles className={clsx('h-4', 'w-4')} />
            Generate
          </button>
        </div>
      </div>
      <ResultBlock title={isEditingReport ? "Report Editor" : "Report Preview"}>
        {progressReport ? (
          isEditingReport ? (
            <textarea
              className={clsx(fieldClass, 'min-h-[400px]', 'font-mono', 'text-[13px]', 'leading-relaxed')}
              value={progressReport}
              onChange={(e) => setProgressReport(e.target.value)}
              placeholder="Customize the generated report here..."
            />
          ) : (
            <div className={clsx('whitespace-pre-wrap', 'text-sm', 'leading-7', 'text-[#191c1d]', 'bg-[#f8f9fa]', 'p-6', 'rounded-xl', 'border', 'border-[#e1e3e4]', 'shadow-inner', 'font-sans', 'prose', 'prose-sm', 'max-w-none')}>
              <ReactMarkdown>{progressReport}</ReactMarkdown>
            </div>
          )
        ) : (
          <LoadingText loading={loadingAction === 'progress'} idle="No report generated yet." />
        )}
      </ResultBlock>
    </section>
  );

  return (
    <Layout activePath={`/projects/${projectId}/ai`} projectId={projectId}>
      <div className={clsx('w-full', 'max-w-7xl', 'mx-auto', 'p-5', 'md:p-8')}>
        <div className={clsx('mb-6', 'flex', 'flex-col', 'gap-4', 'lg:flex-row', 'lg:items-end', 'lg:justify-between')}>
          <div>
            <h1 className={clsx('text-2xl', 'font-bold', 'text-[#191c1d]', 'md:text-3xl')}>AI Workbench</h1>
            <p className={clsx('mt-2', 'max-w-2xl', 'text-sm', 'leading-6', 'text-[#555f6d]')}>
              Run project AI workflows using your preferred model provider.
            </p>
          </div>
          <div className={clsx('flex', 'flex-col', 'items-start', 'lg:items-end', 'gap-2')}>
            <label className={labelClass}>Model Provider</label>
            <select 
              value={selectedProvider} 
              onChange={(e) => setSelectedProvider(e.target.value)}
              className={clsx(fieldClass, 'h-10 w-full lg:w-64 font-semibold text-[#434654]')}
            >
              <option value="auto">Auto-Orchestrate (Fallback)</option>
              <option value="ollama">Ollama (Local Llama 3.2)</option>
              <option value="groq">Groq (Llama 3.3 70B)</option>
              <option value="gemini">Google Gemini 1.5 Flash</option>
            </select>
          </div>
          <div className={clsx('text-sm', 'text-[#737686]')}>{activeLabel}</div>
        </div>

        <div className={clsx('mb-5', 'flex', 'gap-2', 'overflow-x-auto', 'border-b', 'border-[#d7d9e2]', 'pb-2')}>
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-semibold transition-colors ${
                  active ? 'bg-[#003fb1] text-white' : 'bg-white text-[#434654] hover:bg-[#f3f4f5]'
                }`}
              >
                <Icon className={clsx('h-4', 'w-4')} />
                {tab.label}
              </button>
            );
          })}
        </div>

        {activeTab === 'rag' && renderRag()}
        {activeTab === 'task' && renderTask()}
        {activeTab === 'meeting' && renderMeeting()}
        {activeTab === 'feedback' && renderFeedback()}
        {activeTab === 'progress' && renderProgress()}
      </div>
    </Layout>
  );
}
