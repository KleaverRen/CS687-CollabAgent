import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import clsx from 'clsx';
import {
  AlertTriangle,
  AtSign,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  ClipboardList,
  FileText,
  Image,
  Mic,
  MoreHorizontal,
  Paperclip,
  Search,
  Send,
  Settings,
  Sparkles,
  Upload,
  Users,
  Wand2,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import Layout from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import api from '../utils/api';

const tabs = [
  { id: 'rag', label: 'Knowledge Agent', shortLabel: 'Knowledge', icon: FileText, tone: 'emerald', status: 'Searching' },
  { id: 'task', label: 'Task Orchestrator', shortLabel: 'Tasks', icon: Bot, tone: 'blue', status: 'Analyzing' },
  { id: 'meeting', label: 'Team Coordinator', shortLabel: 'Team', icon: Users, tone: 'slate', status: 'Idle' },
  { id: 'feedback', label: 'Feedback Agent', shortLabel: 'Feedback', icon: FileText, tone: 'red', status: 'Idle' },
  { id: 'progress', label: 'Advisor Analyst', shortLabel: 'Advisor', icon: Sparkles, tone: 'violet', status: 'Ready' },
];

const buttonBase = 'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';
const primaryButton = `${buttonBase} bg-[#0b47c2] text-white hover:bg-[#1353d8]`;
const secondaryButton = `${buttonBase} border border-[#b9c0d4] bg-white text-[#191c1d] hover:bg-[#f3f6ff]`;
const fieldClass = 'w-full rounded-lg border border-[#b9c0d4] bg-white px-3 py-2.5 text-sm text-[#191c1d] outline-none transition-all placeholder:text-[#6b7280] focus:border-[#0b47c2] focus:ring-2 focus:ring-[#0b47c2]/20';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-[0.12em] text-[#4b5563]';

const statusClass = {
  Analyzing: 'bg-[#1f5de8] text-white',
  Searching: 'bg-[#84efbd] text-[#005438]',
  Idle: 'bg-[#dfe3e8] text-[#434654]',
  Ready: 'bg-[#e8ddff] text-[#4f2ca1]',
};

const toneClass = {
  blue: 'bg-[#1f5de8] text-white',
  emerald: 'bg-[#005438] text-white',
  slate: 'bg-[#5f6b7a] text-white',
  red: 'bg-[#c51620] text-white',
  violet: 'bg-[#6d3fd1] text-white',
};

const actionLabels = {
  ingest: 'Document Ingest',
  rag: 'Chat Query',
  task: 'Task Generation',
  meeting: 'Thread Summary',
  feedback: 'Feedback Analysis',
  progress: 'Progress Report',
  'confirm-task': 'Task Confirmation',
};

const getSessionGreeting = () => ([{
  id: `agent-${Date.now()}`,
  sender: 'agent',
  agentId: 'rag',
  timestamp: new Date().toISOString(),
  text: 'Fresh AI agent session initialized. Select an agent or send a prompt to start a new workbench run.',
}]);

function ResultBlock({ title, children }) {
  if (!children) return null;
  return (
    <section className={clsx('rounded-lg', 'border', 'border-[#d5d9e7]', 'bg-white', 'p-4')}>
      <h3 className={clsx('mb-3', 'text-xs', 'font-bold', 'uppercase', 'tracking-[0.12em]', 'text-[#4b5563]')}>{title}</h3>
      {children}
    </section>
  );
}

function LoadingText({ loading, idle }) {
  return <span className={clsx('text-sm', 'text-[#737686]')}>{loading ? 'Running model...' : idle}</span>;
}

function AgentAvatar({ agent, className }) {
  const Icon = agent.icon;
  return (
    <div className={clsx('flex h-12 w-12 shrink-0 items-center justify-center rounded text-white shadow-sm', toneClass[agent.tone], className)}>
      <Icon className={clsx('h-6', 'w-6')} />
    </div>
  );
}

export default function AIWorkbench() {
  const { id: projectId } = useParams();
  const { user } = useAuth();
  const sessionIdRef = useRef('');
  const [activeTab, setActiveTab] = useState('rag');
  const [loadingAction, setLoadingAction] = useState('');
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [chatMessages, setChatMessages] = useState(() => getSessionGreeting());

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

  const isAdvisor = user?.role?.toLowerCase() === 'advisor';
  const activeAgent = useMemo(() => tabs.find(tab => tab.id === activeTab) || tabs[0], [activeTab]);

  const agentDescriptions = useMemo(() => ({
    rag: ragAnswer ? 'Answer ready from indexed knowledge.' : docTitle || docContent ? 'Document ready to index.' : 'Indexing new research material.',
    task: taskDraft ? 'Task draft prepared for confirmation.' : taskRequest ? 'Parsing natural language task request.' : 'Refining project milestones for Phase 2.',
    meeting: meetingResult ? 'Action items extracted from the latest sync.' : transcript ? 'Reviewing meeting transcript.' : 'Ready to align member schedules.',
    feedback: feedbackResult ? 'Advisor response template prepared.' : feedbackBody ? 'Analyzing advisor feedback.' : 'Awaiting draft submission.',
    progress: progressReport ? 'Weekly advisor report generated.' : 'Monitoring progress signals.',
  }), [docContent, docTitle, feedbackBody, feedbackResult, meetingResult, progressReport, ragAnswer, taskDraft, taskRequest, transcript]);

  const logWorkbenchActivity = useCallback(async ({ actionType, status, metadata = {} }) => {
    if (!projectId) return;

    try {
      await api.post('/agents/coordination/activity', {
        projectId,
        actionType,
        status,
        timestamp: new Date().toISOString(),
        metadata: {
          sessionId: sessionIdRef.current,
          activeAgent: activeAgent.label,
          provider: selectedProvider,
          ...metadata,
        },
      });
    } catch (err) {
      console.error('[AIWorkbench] Failed to log activity:', err);
    }
  }, [activeAgent.label, projectId, selectedProvider]);

  useEffect(() => {
    sessionIdRef.current = `aiw-${projectId || 'global'}-${Date.now()}`;
    localStorage.removeItem(`aiworkbench:${projectId}:chat`);
    localStorage.removeItem(`aiworkbench:${projectId}:draft`);

    setActiveTab('rag');
    setLoadingAction('');
    setSelectedProvider('auto');
    setDocTitle('');
    setDocContent('');
    setRagQuery('');
    setRagAnswer(null);
    setTaskRequest('');
    setTaskDraft(null);
    setTranscript('');
    setMeetingResult(null);
    setFeedbackBody('');
    setFeedbackSeverity('medium');
    setFeedbackResult(null);
    setProgressReport('');
    setIsEditingReport(false);
    setChatMessages(getSessionGreeting());

    if (projectId && user?.id) {
      api.post('/agents/coordination/activity', {
        projectId,
        actionType: 'Agent Session Initialized',
        status: 'success',
        timestamp: new Date().toISOString(),
        metadata: {
          sessionId: sessionIdRef.current,
          userId: user.id,
          role: user.role,
          activeAgent: 'Knowledge Agent',
          provider: 'auto',
        },
      }).catch((err) => console.error('[AIWorkbench] Failed to log session initialization:', err));
    }
  }, [projectId, user?.id, user?.role]);

  const appendUserMessage = (text) => {
    setChatMessages((messages) => [
      ...messages,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        timestamp: new Date().toISOString(),
        text,
      },
    ]);
  };

  const appendAgentMessage = (text, agentId = activeTab) => {
    setChatMessages((messages) => [
      ...messages,
      {
        id: `agent-${Date.now()}`,
        sender: 'agent',
        agentId,
        timestamp: new Date().toISOString(),
        text,
      },
    ]);
  };

  const handleToolSwitch = (nextTab) => {
    if (nextTab === activeTab) return;
    const nextAgent = tabs.find(tab => tab.id === nextTab);
    setActiveTab(nextTab);
    logWorkbenchActivity({
      actionType: 'Tool Switch',
      status: 'success',
      metadata: {
        fromAgent: activeAgent.label,
        toAgent: nextAgent?.label,
      },
    });
  };

  const runAction = async (key, action) => {
    setLoadingAction(key);
    const actionType = actionLabels[key] || 'Agent Request';
    try {
      const result = await action();
      if (result === false) return;
      await logWorkbenchActivity({
        actionType: 'Agent Response',
        status: 'success',
        metadata: { workflow: key, responseType: actionType },
      });
      appendAgentMessage(`${activeAgent.label} completed ${actionType.toLowerCase()}. Review the generated output below.`, activeTab);
    } catch (err) {
      await logWorkbenchActivity({
        actionType: 'Agent Response',
        status: 'failed',
        metadata: {
          workflow: key,
          responseType: actionType,
          error: err.response?.data?.error || err.message,
        },
      });
      toast.error(err.response?.data?.error || 'AI request failed.');
    } finally {
      setLoadingAction('');
    }
  };

  const ingestDocument = () => runAction('ingest', async () => {
    if (!docTitle.trim() || !docContent.trim()) {
      toast.error('Add a document title and content first.');
      return false;
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
      return false;
    }
    const { data } = await api.post('/agents/rag/query', {
      query: ragQuery,
      projectId,
      limit: 3,
      provider: selectedProvider === 'auto' ? null : selectedProvider,
    });
    setRagAnswer(data);
  });

  const parseTask = () => runAction('task', async () => {
    if (!taskRequest.trim()) {
      toast.error('Describe the task first.');
      return false;
    }
    const { data } = await api.post('/agents/task/parse', {
      request: taskRequest,
      projectId,
      provider: selectedProvider === 'auto' ? null : selectedProvider,
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
      return false;
    }
    const { data } = await api.post('/agents/coordination/meeting', {
      transcript,
      projectId,
      provider: selectedProvider === 'auto' ? null : selectedProvider,
    });
    setMeetingResult(data);
  });

  const submitFeedback = () => runAction('feedback', async () => {
    if (!feedbackBody.trim()) {
      toast.error('Add feedback text first.');
      return false;
    }
    const { data } = await api.post('/agents/feedback/submit', {
      projectId,
      body: feedbackBody,
      severity: feedbackSeverity,
      category: 'general',
      provider: selectedProvider === 'auto' ? null : selectedProvider,
    });
    setFeedbackResult(data);
    toast.success('Feedback recorded.');
  });

  const generateProgressReport = () => runAction('progress', async () => {
    const { data } = await api.get(`/agents/progress/report?projectId=${projectId}&provider=${selectedProvider === 'auto' ? '' : selectedProvider}`);
    setProgressReport(data.report);
  });

  const runActiveAgent = () => {
    const prompt = String(composerValue || '').trim();
    appendUserMessage(prompt || `${activeAgent.label} requested.`);
    logWorkbenchActivity({
      actionType: 'Chat Query',
      status: 'submitted',
      metadata: {
        workflow: activeTab,
        promptPreview: prompt.slice(0, 160),
      },
    });

    if (activeTab === 'rag') return askDocuments();
    if (activeTab === 'task') return parseTask();
    if (activeTab === 'meeting') return summarizeMeeting();
    if (activeTab === 'feedback') return submitFeedback();
    return generateProgressReport();
  };

  const renderRag = () => (
    <div className="space-y-4">
      <ResultBlock title="Index Project Document">
        <div className={clsx('grid', 'gap-3', 'lg:grid-cols-[0.8fr_1.2fr_auto]')}>
          <input className={fieldClass} value={docTitle} onChange={(e) => setDocTitle(e.target.value)} placeholder="Document title" />
          <textarea className={`${fieldClass} min-h-11 resize-y`} value={docContent} onChange={(e) => setDocContent(e.target.value)} placeholder="Paste project documentation here." />
          <button className={secondaryButton} disabled={loadingAction === 'ingest'} onClick={ingestDocument}>
            <Upload className={clsx('h-4', 'w-4')} />
            Queue
          </button>
        </div>
      </ResultBlock>

      <ResultBlock title="Knowledge Response">
        {ragAnswer ? (
          <div className="space-y-4">
            <p className={clsx('whitespace-pre-wrap', 'text-sm', 'leading-6', 'text-[#191c1d]')}>{ragAnswer.answer}</p>
            {ragAnswer.sources?.length > 0 && (
              <div className="space-y-2">
                {ragAnswer.sources.map((source) => (
                  <div key={source.chunkId} className={clsx('rounded-lg', 'bg-[#f3f6ff]', 'p-3', 'text-xs', 'text-[#434654]')}>
                    <div className={clsx('font-semibold', 'text-[#191c1d]')}>{source.documentTitle}</div>
                    <div className="mt-1">{source.snippet}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <LoadingText loading={loadingAction === 'rag'} idle="Ask the knowledge base from the message composer." />
        )}
      </ResultBlock>
    </div>
  );

  const renderTask = () => (
    <ResultBlock title="Generated Task">
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
        <LoadingText loading={loadingAction === 'task'} idle="Describe a task in the composer to draft structured work." />
      )}
    </ResultBlock>
  );

  const renderMeeting = () => (
    <ResultBlock title="Summary & Action Items">
      {meetingResult ? (
        <div className="space-y-4">
          <p className={clsx('text-sm', 'leading-6', 'text-[#191c1d]')}>{meetingResult.summary}</p>
          <div className="space-y-2">
            {meetingResult.actionItemDrafts?.map((item, index) => (
              <div key={`${item.title}-${index}`} className={clsx('flex', 'flex-col', 'gap-3', 'rounded-lg', 'bg-[#f3f6ff]', 'p-3', 'sm:flex-row', 'sm:items-center', 'sm:justify-between')}>
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
        <LoadingText loading={loadingAction === 'meeting'} idle="Paste meeting notes in the composer to extract actions." />
      )}
    </ResultBlock>
  );

  const renderFeedback = () => (
    <div className="space-y-4">
      <div>
        <label className={labelClass}>Severity</label>
        <select className={fieldClass} value={feedbackSeverity} onChange={(e) => setFeedbackSeverity(e.target.value)}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="urgent">Urgent</option>
        </select>
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
          <LoadingText loading={loadingAction === 'feedback'} idle="Paste advisor feedback in the composer for analysis." />
        )}
      </ResultBlock>
    </div>
  );

  const renderProgress = () => (
    <ResultBlock title={isEditingReport ? 'Report Editor' : 'Report Preview'}>
      {progressReport ? (
        isEditingReport ? (
          <textarea
            className={clsx(fieldClass, 'min-h-[320px] font-mono text-[13px] leading-relaxed')}
            value={progressReport}
            onChange={(e) => setProgressReport(e.target.value)}
            placeholder="Customize the generated report here..."
          />
        ) : (
          <div className={clsx('max-w-none', 'rounded-lg', 'border', 'border-[#e1e3e4]', 'bg-[#f8f9fa]', 'p-5', 'text-sm', 'leading-7', 'text-[#191c1d]', 'prose', 'prose-sm')}>
            <ReactMarkdown>{progressReport}</ReactMarkdown>
          </div>
        )
      ) : (
        <LoadingText loading={loadingAction === 'progress'} idle="Generate a weekly progress report from the advisor panel." />
      )}
    </ResultBlock>
  );

  const renderWorkflow = () => {
    if (activeTab === 'rag') return renderRag();
    if (activeTab === 'task') return renderTask();
    if (activeTab === 'meeting') return renderMeeting();
    if (activeTab === 'feedback') return renderFeedback();
    return renderProgress();
  };

  const composerValue = {
    rag: ragQuery,
    task: taskRequest,
    meeting: transcript,
    feedback: feedbackBody,
    progress: progressReport,
  }[activeTab];

  const updateComposer = (value) => {
    if (activeTab === 'rag') setRagQuery(value);
    if (activeTab === 'task') setTaskRequest(value);
    if (activeTab === 'meeting') setTranscript(value);
    if (activeTab === 'feedback') setFeedbackBody(value);
    if (activeTab === 'progress') setProgressReport(value);
  };

  return (
    <Layout activePath={`/projects/${projectId}/ai`} projectId={projectId}>
      <div className={clsx('flex', 'min-h-full', 'flex-col', 'bg-[#f8f9fb]')}>
        <header className={clsx('flex', 'min-h-20', 'flex-col', 'gap-4', 'border-b', 'border-[#c8cde0]', 'bg-white', 'px-5', 'py-4', 'xl:flex-row', 'xl:items-center', 'xl:justify-between')}>
          <div className={clsx('flex', 'w-full', 'max-w-2xl', 'items-center', 'gap-3', 'rounded-2xl', 'bg-[#f3f4f5]', 'px-4', 'py-3', 'text-[#5f6b7a]')}>
            <Search className={clsx('h-5', 'w-5', 'shrink-0', 'text-[#1f2937]')} />
            <span className={clsx('truncate', 'text-sm', 'md:text-base')}>Search across agents and knowledge base...</span>
          </div>
          <div className={clsx('flex', 'items-center', 'justify-between', 'gap-4', 'xl:justify-end')}>
            <select
              value={selectedProvider}
              onChange={(e) => setSelectedProvider(e.target.value)}
              className={clsx('h-10', 'rounded-lg', 'border', 'border-[#c3c5d7]', 'bg-white', 'px-3', 'text-sm', 'font-semibold', 'text-[#434654]', 'outline-none', 'focus:border-[#0b47c2]')}
            >
              <option value="auto">Auto-Orchestrate</option>
              <option value="ollama">Ollama</option>
              <option value="groq">Groq</option>
              <option value="gemini">Gemini</option>
            </select>
            <Bot className={clsx('h-5', 'w-5', 'text-[#0b47c2]')} />
            <Bell className={clsx('h-5', 'w-5', 'text-[#1f2937]')} />
            <Settings className={clsx('h-5', 'w-5', 'text-[#1f2937]')} />
            <div className={clsx('flex', 'items-center', 'gap-3')}>
              <div className={clsx('h-10', 'w-10', 'rounded-full', 'bg-[linear-gradient(135deg,#d4f1ff,#f5c6d6)]')} />
              <span className={clsx('hidden', 'text-sm', 'font-bold', 'text-[#111827]', 'md:inline')}>{user?.full_name || 'AI Workbench User'}</span>
            </div>
          </div>
        </header>

        <div
          className={clsx(
            'grid flex-1 overflow-hidden',
            isAdvisor
              ? 'xl:grid-cols-[300px_minmax(390px,1fr)_300px] 2xl:grid-cols-[360px_minmax(460px,1fr)_360px]'
              : 'xl:grid-cols-[320px_minmax(0,1fr)] 2xl:grid-cols-[380px_minmax(0,1fr)]'
          )}
        >
          <aside className={clsx('flex', 'min-h-[360px]', 'flex-col', 'border-b', 'border-[#c8cde0]', 'bg-white', 'xl:border-b-0', 'xl:border-r')}>
            <div className={clsx('border-b', 'border-[#c8cde0]', 'px-5', 'py-8')}>
              <h1 className={clsx('text-3xl', 'font-bold', 'tracking-normal', 'text-[#111827]')}>AI Agents</h1>
              <p className={clsx('mt-2', 'text-sm', 'text-[#191c1d]')}>Manage specialized collaboration agents.</p>
            </div>
            <div className={clsx('flex-1', 'space-y-4', 'overflow-y-auto', 'p-5')}>
              {tabs.map((agent) => {
                const active = activeTab === agent.id;
                return (
                  <button
                    key={agent.id}
                    onClick={() => handleToolSwitch(agent.id)}
                    className={clsx(
                      'w-full rounded-lg border p-4 text-left transition-colors',
                      active ? 'border-[#b9c7f8] bg-[#f1f5ff]' : 'border-[#c8cde0] bg-white hover:bg-[#f8f9fb]'
                    )}
                  >
                    <div className={clsx('flex', 'items-start', 'justify-between', 'gap-3')}>
                      <AgentAvatar agent={agent} />
                      <span className={clsx('rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide', statusClass[agent.status])}>{agent.status}</span>
                    </div>
                    <h2 className={clsx('mt-3', 'text-sm', 'font-bold', 'tracking-[0.08em]', 'text-[#001f8f]')}>{agent.label}</h2>
                    <p className={clsx('mt-2', 'line-clamp-2', 'text-sm', 'leading-5', 'text-[#3f4654]')}>{agentDescriptions[agent.id]}</p>
                  </button>
                );
              })}
            </div>
            <div className={clsx('border-t', 'border-[#c8cde0]', 'p-5')}>
              <button className={clsx('flex', 'h-12', 'w-full', 'items-center', 'justify-center', 'gap-2', 'rounded', 'border', 'border-[#0b47c2]', 'bg-white', 'text-base', 'font-semibold', 'text-[#0b47c2]', 'hover:bg-[#f1f5ff]')}>
                <span className={clsx('flex', 'h-6', 'w-6', 'items-center', 'justify-center', 'rounded-full', 'border-2', 'border-[#0b47c2]', 'text-lg', 'leading-none')}>+</span>
                Add Specialized Agent
              </button>
            </div>
          </aside>

          <main className={clsx('flex', 'min-h-[720px]', 'flex-col', 'overflow-hidden', 'border-b', 'border-[#c8cde0]', 'bg-[#f8f9fb]', 'xl:border-b-0')}>
            <div className={clsx('flex', 'min-h-[100px]', 'items-center', 'justify-between', 'gap-4', 'border-b', 'border-[#c8cde0]', 'bg-white', 'px-6', 'py-4')}>
              <div className={clsx('flex', 'items-center', 'gap-4')}>
                <div>
                  <p className={clsx('text-xs', 'font-bold', 'uppercase', 'tracking-[0.16em]', 'text-[#303846]')}>Active Agents:</p>
                  <div className={clsx('mt-2', 'flex', '-space-x-1')}>
                    {tabs.slice(0, 3).map((agent) => <AgentAvatar key={agent.id} agent={agent} className={clsx('h-8', 'w-8', 'rounded-full', 'ring-2', 'ring-white', '[&>svg]:h-4', '[&>svg]:w-4')} />)}
                    <span className={clsx('flex', 'h-8', 'w-8', 'items-center', 'justify-center', 'rounded-full', 'bg-[#dfe3e8]', 'ring-2', 'ring-white')}><MoreHorizontal className={clsx('h-4', 'w-4')} /></span>
                  </div>
                </div>
                <p className={clsx('hidden', 'max-w-48', 'text-sm', 'italic', 'leading-5', 'text-[#303846]', 'md:block')}>{activeAgent.label} is summarizing context...</p>
              </div>
              <button className={secondaryButton} onClick={() => handleToolSwitch('task')}>
                <Wand2 className={clsx('h-4', 'w-4', 'text-[#0b47c2]')} />
                Summon Agent
              </button>
            </div>

            <div className={clsx('flex-1', 'space-y-6', 'overflow-y-auto', 'px-5', 'py-8', 'md:px-10')}>
              <div className={clsx('mx-auto', 'w-fit', 'rounded-full', 'bg-[#e5e7eb]', 'px-5', 'py-1.5', 'text-sm', 'text-[#303846]')}>
                Conversation initiated at {new Date(chatMessages[0]?.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>

              {chatMessages.map((message) => {
                const messageAgent = tabs.find(tab => tab.id === message.agentId) || activeAgent;
                const timeLabel = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                if (message.sender === 'user') {
                  return (
                    <div key={message.id} className={clsx('flex', 'justify-end', 'gap-3')}>
                      <div className="max-w-[520px]">
                        <div className={clsx('mb-2', 'flex', 'items-center', 'justify-end', 'gap-2', 'text-sm')}>
                          <span className={clsx('font-bold', 'text-[#111827]')}>{user?.full_name || 'User'}</span>
                          <span className="text-[#303846]">{timeLabel}</span>
                        </div>
                        <div className={clsx('rounded-[20px]', 'rounded-tr-sm', 'bg-[#1f5de8]', 'px-5', 'py-4', 'text-base', 'leading-7', 'text-white', 'shadow-sm', '2xl:text-lg', '2xl:leading-8')}>
                          {message.text}
                        </div>
                      </div>
                      <div className={clsx('mt-8', 'flex', 'h-12', 'w-12', 'shrink-0', 'items-center', 'justify-center', 'rounded-full', 'bg-[#0b47c2]', 'text-sm', 'font-bold', 'text-white')}>
                        {user?.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                    </div>
                  );
                }

                return (
                  <div key={message.id} className={clsx('flex', 'gap-4')}>
                    <AgentAvatar agent={messageAgent} className="mt-8" />
                    <div className={clsx('max-w-[560px]', 'flex-1')}>
                      <div className={clsx('mb-2', 'flex', 'items-center', 'gap-2', 'text-sm')}>
                        <span className={clsx('font-bold', 'text-[#001f8f]')}>{messageAgent.label}</span>
                        <span className="text-[#303846]">{timeLabel}</span>
                      </div>
                      <div className={clsx('border-l-4', 'border-[#1f5de8]', 'bg-white', 'p-5', 'text-sm', 'leading-6', 'shadow-sm', 'ring-1', 'ring-[#1f5de8]', '2xl:text-base', '2xl:leading-7')}>
                        <p>{message.text}</p>
                        <div className={clsx('mt-4', 'rounded', 'bg-[#f1f5ff]', 'p-4', 'text-sm')}>
                          <p className={clsx('font-bold', 'uppercase', 'text-[#003fb1]')}>Proposed Action</p>
                          <p className={clsx('mt-1', 'italic')}>"{activeTab === 'rag' ? 'Search indexed documents for supporting evidence.' : activeTab === 'task' ? 'Convert this request into a structured project task.' : activeTab === 'meeting' ? 'Summarize coordination notes and extract action items.' : activeTab === 'feedback' ? 'Analyze advisor feedback and draft a response.' : 'Generate an advisor-ready weekly progress report.'}"</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {renderWorkflow()}
            </div>

            <div className={clsx('border-t', 'border-[#c8cde0]', 'bg-white', 'px-5', 'py-5')}>
              <div className={clsx('mb-5', 'grid', 'gap-3', 'md:grid-cols-3')}>
                <button className={secondaryButton} onClick={() => handleToolSwitch('meeting')}>
                  <FileText className={clsx('h-4', 'w-4')} />
                  Summarize Thread
                </button>
                <button className={secondaryButton} onClick={() => handleToolSwitch('task')}>
                  <ClipboardList className={clsx('h-4', 'w-4')} />
                  Generate Task
                </button>
                <button className={secondaryButton} onClick={() => handleToolSwitch('rag')}>
                  <Search className={clsx('h-4', 'w-4')} />
                  Search Knowledge Base
                </button>
              </div>

              <div className={clsx('rounded-2xl', 'bg-white', 'p-4', 'shadow-xl', 'shadow-slate-200', 'ring-1', 'ring-[#eef1f6]')}>
                <textarea
                  className={clsx('min-h-28', 'w-full', 'resize-y', 'rounded-xl', 'border-0', 'px-2', 'py-2', 'text-base', 'text-[#191c1d]', 'outline-none', 'placeholder:text-[#6b7280]')}
                  value={composerValue}
                  onChange={(e) => updateComposer(e.target.value)}
                  placeholder="Type a message or '@' to tag an agent..."
                />
                <div className={clsx('flex', 'flex-wrap', 'items-center', 'justify-between', 'gap-3', 'pt-2')}>
                  <div className={clsx('flex', 'items-center', 'gap-4', 'text-[#1f2937]')}>
                    <Paperclip className={clsx('h-5', 'w-5')} />
                    <Mic className={clsx('h-5', 'w-5')} />
                    <Image className={clsx('h-5', 'w-5')} />
                    <span className={clsx('h-6', 'w-px', 'bg-[#c8cde0]')} />
                    <span className={clsx('inline-flex', 'items-center', 'gap-1', 'text-sm', 'font-semibold')}>
                      <AtSign className={clsx('h-4', 'w-4')} />
                      Agents
                    </span>
                  </div>
                  <button className={primaryButton} disabled={Boolean(loadingAction)} onClick={runActiveAgent}>
                    Send
                    <Send className={clsx('h-4', 'w-4')} />
                  </button>
                </div>
              </div>
            </div>
          </main>

          {isAdvisor && (
          <aside className={clsx('flex', 'min-h-[720px]', 'flex-col', 'bg-white')}>
            <div className={clsx('border-b', 'border-[#c8cde0]', 'p-6')}>
              <div className={clsx('mb-5', 'flex', 'items-center', 'justify-between')}>
                <h2 className={clsx('text-sm', 'font-bold', 'uppercase', 'tracking-[0.12em]', 'text-[#111827]')}>Advisor View</h2>
                <Sparkles className={clsx('h-5', 'w-5', 'text-[#0b47c2]')} />
              </div>
              <div className={clsx('mb-5', 'flex', 'items-center', 'gap-3')}>
                <div className={clsx('h-2', 'flex-1', 'rounded-full', 'bg-[#d8dde5]')}>
                  <div className={clsx('h-full', 'w-[65%]', 'rounded-full', 'bg-[#1f5de8]')} />
                </div>
                <span className={clsx('text-sm', 'font-bold', 'text-[#111827]')}>65%</span>
              </div>
              <p className={clsx('text-sm', 'italic', 'leading-5', 'text-[#303846]')}>AI-generated status based on current workbench messages.</p>
            </div>

            <div className={clsx('flex-1', 'space-y-7', 'overflow-y-auto', 'p-6')}>
              <section>
                <div className={clsx('mb-3', 'flex', 'items-center', 'gap-3')}>
                  <CheckCircle2 className={clsx('h-6', 'w-6', 'text-[#005438]')} />
                  <h3 className={clsx('text-sm', 'font-bold', 'tracking-[0.08em]', 'text-[#111827]')}>Key Achievements</h3>
                </div>
                <ul className={clsx('space-y-3', 'text-sm', 'leading-6', 'text-[#191c1d]')}>
                  <li className={clsx('flex', 'gap-3')}><span className={clsx('mt-2', 'h-1.5', 'w-1.5', 'rounded-full', 'bg-[#007a53]')} />Workflow agents connected to existing AI endpoints.</li>
                  <li className={clsx('flex', 'gap-3')}><span className={clsx('mt-2', 'h-1.5', 'w-1.5', 'rounded-full', 'bg-[#007a53]')} />Knowledge search, task generation, and feedback analysis remain available.</li>
                </ul>
              </section>

              <section>
                <div className={clsx('mb-3', 'flex', 'items-center', 'gap-3')}>
                  <AlertTriangle className={clsx('h-6', 'w-6', 'text-[#d11c1c]')} />
                  <h3 className={clsx('text-sm', 'font-bold', 'tracking-[0.08em]', 'text-[#111827]')}>Potential Blockers</h3>
                </div>
                <div className={clsx('rounded-lg', 'border', 'border-[#ffd1ce]', 'bg-[#fff0ee]', 'p-4')}>
                  <h4 className={clsx('font-bold', 'text-[#a40000]')}>Cluster Capacity Alert</h4>
                  <p className={clsx('mt-2', 'text-sm', 'leading-5', 'text-[#b42318]')}>Proposed simulation requires 15% more TFLOPs than currently allocated to Dr. Thorne.</p>
                </div>
              </section>

              <section>
                <h3 className={clsx('mb-3', 'text-sm', 'font-bold', 'tracking-[0.08em]', 'text-[#111827]')}>AI Recommendations</h3>
                <div className="space-y-3">
                  <button className={clsx('w-full', 'rounded-lg', 'border', 'border-[#c8cde0]', 'bg-white', 'p-4', 'text-left', 'hover:bg-[#f8f9fb]')} onClick={generateProgressReport}>
                    <span className={clsx('block', 'font-bold', 'text-[#111827]')}>Generate Weekly Report</span>
                    <span className={clsx('mt-1', 'block', 'text-sm', 'text-[#303846]')}>Create an advisor-ready project summary.</span>
                  </button>
                  <button className={clsx('w-full', 'rounded-lg', 'border', 'border-[#c8cde0]', 'bg-white', 'p-4', 'text-left', 'hover:bg-[#f8f9fb]')} onClick={() => handleToolSwitch('feedback')}>
                    <span className={clsx('block', 'font-bold', 'text-[#111827]')}>Schedule Peer Review</span>
                    <span className={clsx('mt-1', 'block', 'text-sm', 'text-[#303846]')}>Engage Feedback Agent for validation.</span>
                  </button>
                </div>
              </section>
            </div>

            <div className={clsx('border-t', 'border-[#c8cde0]', 'p-6')}>
              {progressReport && (
                <button className={clsx(secondaryButton, 'mb-3 w-full')} onClick={() => setIsEditingReport(!isEditingReport)}>
                  {isEditingReport ? 'View Preview' : 'Edit Report'}
                </button>
              )}
              <button className={clsx('h-12', 'w-full', 'rounded', 'bg-[#5f6b7a]', 'text-base', 'font-semibold', 'text-white', 'hover:bg-[#4b5563]')} onClick={generateProgressReport} disabled={loadingAction === 'progress'}>
                Export Weekly Report
              </button>
            </div>
          </aside>
          )}
        </div>
      </div>
    </Layout>
  );
}
