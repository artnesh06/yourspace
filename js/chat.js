/**
 * Chat.js — AI Agent for Board Manipulation
 * Uses Groq API (free tier, fast inference)
 * Supports agentic loop with tools for board operations
 */

const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const GROQ_MODEL = 'llama-3.3-70b-versatile';
const CHAT_STORAGE_KEY = 'chat-history-v1';
const API_KEY_STORAGE_KEY = 'groq-api-key';
const MAX_HISTORY = 50;

let chatHistory = [];
let isProcessing = false;

// Tool definitions for Groq
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'add_card',
      description: 'Add a new card to a specific column',
      parameters: {
        type: 'object',
        properties: {
          columnId: { type: 'string', description: 'Column ID (c1, c2, c3, c4)' },
          title: { type: 'string', description: 'Card title' },
          description: { type: 'string', description: 'Card description (optional)' }
        },
        required: ['columnId', 'title']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'move_card',
      description: 'Move a card from one column to another',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID' },
          targetColumnId: { type: 'string', description: 'Target column ID' }
        },
        required: ['cardId', 'targetColumnId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'update_card_title',
      description: 'Update a card title',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID' },
          newTitle: { type: 'string', description: 'New title' }
        },
        required: ['cardId', 'newTitle']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'delete_card',
      description: 'Delete a card from the board',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID to delete' }
        },
        required: ['cardId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'mark_card_done',
      description: 'Mark a card as done (move to Done column)',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID to mark done' }
        },
        required: ['cardId']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'set_due_date',
      description: 'Set or update due date for a card',
      parameters: {
        type: 'object',
        properties: {
          cardId: { type: 'string', description: 'Card ID' },
          dueDate: { type: 'string', description: 'Due date (YYYY-MM-DD format)' }
        },
        required: ['cardId', 'dueDate']
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'list_cards',
      description: 'List all cards on the board with their details',
      parameters: {
        type: 'object',
        properties: {
          columnId: { type: 'string', description: 'Optional: filter by column ID' }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'get_board_status',
      description: 'Get current board status (column names and card counts)',
      parameters: {
        type: 'object',
        properties: {}
      }
    }
  }
];

// ─────────── STORAGE ───────────
function loadChatHistory() {
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

function saveChatHistory() {
  try {
    const toSave = chatHistory.slice(-MAX_HISTORY);
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
  } catch (err) {
    console.warn('Failed to save chat history:', err);
  }
}

function loadApiKey() {
  try {
    return localStorage.getItem(API_KEY_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function saveApiKey(key) {
  try {
    localStorage.setItem(API_KEY_STORAGE_KEY, key);
  } catch (err) {
    console.warn('Failed to save API key:', err);
  }
}

// ─────────── TOOL EXECUTION ───────────
function executeToolCall(toolName, toolInput) {
  let result = {};

  switch (toolName) {
    case 'add_card':
      result = toolAddCard(toolInput.columnId, toolInput.title, toolInput.description || '');
      break;
    case 'move_card':
      result = toolMoveCard(toolInput.cardId, toolInput.targetColumnId);
      break;
    case 'update_card_title':
      result = toolUpdateCardTitle(toolInput.cardId, toolInput.newTitle);
      break;
    case 'delete_card':
      result = toolDeleteCard(toolInput.cardId);
      break;
    case 'mark_card_done':
      result = toolMarkCardDone(toolInput.cardId);
      break;
    case 'set_due_date':
      result = toolSetDueDate(toolInput.cardId, toolInput.dueDate);
      break;
    case 'list_cards':
      result = toolListCards(toolInput.columnId || null);
      break;
    case 'get_board_status':
      result = toolGetBoardStatus();
      break;
    default:
      result = { success: false, error: `Unknown tool: ${toolName}` };
  }

  return result;
}

// Tool implementations
function toolAddCard(colId, title, desc) {
  try {
    const col = kanban.cols.find(c => c.id === colId);
    if (!col) return { success: false, error: `Column ${colId} not found` };

    const card = {
      id: uid(),
      title,
      desc,
      descHtml: plainTextToRichHtml(desc),
      due: '',
      dueTime: '',
      img: '',
      attachments: [],
      posted: false,
      createdAt: new Date().toISOString(),
      createdBy: '',
      comments: []
    };
    col.cards.push(card);
    saveLocalData();
    renderKanban();
    return { success: true, cardId: card.id, message: `Added "${title}" to ${col.name}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolMoveCard(cardId, targetColId) {
  try {
    const found = getKanbanCard(cardId);
    if (!found) return { success: false, error: `Card ${cardId} not found` };

    const targetCol = kanban.cols.find(c => c.id === targetColId);
    if (!targetCol) return { success: false, error: `Column ${targetColId} not found` };

    const cardIndex = found.col.cards.findIndex(c => c.id === cardId);
    const [movedCard] = found.col.cards.splice(cardIndex, 1);
    targetCol.cards.push(movedCard);
    saveLocalData();
    renderKanban();
    return { success: true, message: `Moved "${movedCard.title}" to ${targetCol.name}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolUpdateCardTitle(cardId, newTitle) {
  try {
    const found = getKanbanCard(cardId);
    if (!found) return { success: false, error: `Card ${cardId} not found` };

    found.card.title = newTitle;
    saveLocalData();
    renderKanban();
    return { success: true, message: `Updated card title to "${newTitle}"` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolDeleteCard(cardId) {
  try {
    const found = getKanbanCard(cardId);
    if (!found) return { success: false, error: `Card ${cardId} not found` };

    const title = found.card.title;
    const idx = found.col.cards.findIndex(c => c.id === cardId);
    found.col.cards.splice(idx, 1);
    saveLocalData();
    renderKanban();
    return { success: true, message: `Deleted "${title}"` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolMarkCardDone(cardId) {
  try {
    const found = getKanbanCard(cardId);
    if (!found) return { success: false, error: `Card ${cardId} not found` };

    const doneCol = kanban.cols.find(c => c.name === 'Done');
    if (!doneCol) return { success: false, error: 'Done column not found' };

    const idx = found.col.cards.findIndex(c => c.id === cardId);
    const [movedCard] = found.col.cards.splice(idx, 1);
    doneCol.cards.push(movedCard);
    saveLocalData();
    renderKanban();
    return { success: true, message: `Marked "${movedCard.title}" as done` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolSetDueDate(cardId, dueDate) {
  try {
    const found = getKanbanCard(cardId);
    if (!found) return { success: false, error: `Card ${cardId} not found` };

    found.card.due = dueDate;
    saveLocalData();
    renderKanban();
    return { success: true, message: `Set due date to ${dueDate} for "${found.card.title}"` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolListCards(colId) {
  try {
    let cards = [];
    if (colId) {
      const col = kanban.cols.find(c => c.id === colId);
      if (!col) return { success: false, error: `Column ${colId} not found` };
      cards = col.cards;
    } else {
      kanban.cols.forEach(col => {
        cards.push(...col.cards.map(c => ({ ...c, columnName: col.name })));
      });
    }

    const summary = cards.map(c => ({
      id: c.id,
      title: c.title,
      column: c.columnName || kanban.cols.find(col => col.cards.includes(c))?.name,
      due: c.due || 'no due date'
    }));

    return { success: true, cards: summary, count: cards.length };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function toolGetBoardStatus() {
  try {
    const status = kanban.cols.map(col => ({
      id: col.id,
      name: col.name,
      cardCount: col.cards.length
    }));
    return { success: true, columns: status, totalCards: kanban.cols.reduce((sum, c) => sum + c.cards.length, 0) };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

// ─────────── GROQ API ───────────
async function callGroqAPI(messages, apiKey) {
  const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages,
      tools: TOOLS,
      tool_choice: 'auto',
      max_tokens: 1024
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Groq API error: ${response.status}`);
  }

  return response.json();
}

// ─────────── AGENTIC LOOP ───────────
async function processUserMessage(userMessage, apiKey) {
  if (!apiKey || !userMessage.trim()) {
    return { error: 'API key or message missing' };
  }

  isProcessing = true;
  try {
    // Add user message to history
    chatHistory.push({ role: 'user', content: userMessage });

    // Prepare messages for API
    let messages = chatHistory.map(msg => ({
      role: msg.role,
      content: msg.content
    }));

    let response;
    let choice;
    let iterCount = 0;
    const maxIter = 5;

    // Agentic loop
    while (iterCount < maxIter) {
      iterCount++;
      
      response = await callGroqAPI(messages, apiKey);
      choice = response.choices[0];

      if (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
        const toolCalls = choice.message.tool_calls;
        const assistantMsg = {
          role: 'assistant',
          content: choice.message.content || '',
          tool_calls: toolCalls
        };
        messages.push(assistantMsg);

        const toolResults = [];
        for (const toolCall of toolCalls) {
          const result = executeToolCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
          toolResults.push({
            tool_call_id: toolCall.id,
            name: toolCall.function.name,
            result
          });
        }

        for (const tr of toolResults) {
          messages.push({
            role: 'user',
            content: `Tool ${tr.name} result: ${JSON.stringify(tr.result)}`
          });
        }
      } else {
        break;
      }
    }

    const finalText = choice && choice.message ? (choice.message.content || 'Task completed.') : 'Task completed.';
    chatHistory.push({ role: 'assistant', content: finalText });
    saveChatHistory();

    return { success: true, response: finalText };
  } catch (err) {
    const errorMsg = `Error: ${err.message}`;
    chatHistory.push({ role: 'assistant', content: errorMsg });
    saveChatHistory();
    return { error: errorMsg };
  } finally {
    isProcessing = false;
  }
}

// ─────────── UI SETUP ───────────
function initChat() {
  chatHistory = loadChatHistory();

  const chatInput = document.getElementById('chat-input');
  const chatSendBtn = document.getElementById('chat-send-btn');
  const chatMessages = document.getElementById('chat-messages');
  const chatFab = document.getElementById('chat-fab');
  const chatPanel = document.getElementById('chat-panel');
  const chatClose = document.getElementById('chat-close');
  const apiKeyInput = document.getElementById('chat-api-key-input');
  const apiKeySaveBtn = document.getElementById('chat-api-key-save-btn');

  if (!chatInput || !chatSendBtn) return;

  renderChatHistory();

  if (apiKeyInput) {
    apiKeyInput.value = loadApiKey();
  }
  if (apiKeySaveBtn) {
    apiKeySaveBtn.addEventListener('click', () => {
      const key = (apiKeyInput?.value || '').trim();
      if (key) {
        saveApiKey(key);
        showChatToast('API key saved!');
      }
    });
  }

  chatSendBtn.addEventListener('click', sendChatMessage);
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  if (chatFab) {
    chatFab.addEventListener('click', () => {
      if (chatPanel) chatPanel.classList.add('open');
    });
  }
  if (chatClose) {
    chatClose.addEventListener('click', () => {
      if (chatPanel) chatPanel.classList.remove('open');
    });
  }

  // Suggestion buttons
  const suggestionBtns = document.querySelectorAll('.chat-suggestion-btn');
  suggestionBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const prompt = btn.dataset.prompt;
      if (prompt) {
        chatInput.value = prompt;
        sendChatMessage();
      }
    });
  });
}

async function sendChatMessage() {
  const chatInput = document.getElementById('chat-input');
  const message = (chatInput?.value || '').trim();

  if (!message || isProcessing) return;

  chatInput.value = '';
  const apiKey = loadApiKey();

  if (!apiKey) {
    showChatToast('Please enter Groq API key first');
    focusApiKeyInput();
    return;
  }

  addMessageToUI('user', message);
  showChatTyping();

  const result = await processUserMessage(message, apiKey);
  hideChatTyping();

  if (result.error) {
    addMessageToUI('assistant', result.error, true);
  } else {
    addMessageToUI('assistant', result.response);
  }
}

function addMessageToUI(role, content, isError = false) {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const emptyState = chatMessages.querySelector('.chat-empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  const msgEl = document.createElement('div');
  msgEl.className = `chat-message chat-message-${role}${isError ? ' chat-message-error' : ''}`;

  const bubble = document.createElement('div');
  bubble.className = 'chat-message-bubble';

  let html = escapeHtml(content);
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');

  bubble.innerHTML = html;
  msgEl.appendChild(bubble);
  chatMessages.appendChild(msgEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function renderChatHistory() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages || !chatHistory.length) return;

  chatHistory.forEach(msg => {
    addMessageToUI(msg.role, msg.content);
  });
}

function showChatTyping() {
  const chatMessages = document.getElementById('chat-messages');
  if (!chatMessages) return;

  const typingEl = document.createElement('div');
  typingEl.className = 'chat-typing';
  typingEl.id = 'chat-typing-indicator';
  typingEl.innerHTML = '<span></span><span></span><span></span>';
  chatMessages.appendChild(typingEl);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideChatTyping() {
  const typingEl = document.getElementById('chat-typing-indicator');
  if (typingEl) typingEl.remove();
}

function showChatToast(message) {
  const toast = document.getElementById('chat-toast');
  if (!toast) return;

  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2000);
}

function focusApiKeyInput() {
  const input = document.getElementById('chat-api-key-input');
  if (input) input.focus();
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Init when app.html loads
document.addEventListener('DOMContentLoaded', initChat);
