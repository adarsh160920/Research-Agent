/**
 * Research Agentic AI — Frontend Application Logic
 * Handles: API calls, UI state, charts (Chart.js), knowledge graph (D3.js),
 * markdown rendering, file uploads, and agent chat.
 */

"use strict";

// ── Global State ──────────────────────────────────────────────────────────
const state = {
  uploadedText: "",
  uploadedFileName: "",
  lastAnalysis: null,
  dashboardData: null,
  chatContext: {},
  trendsChartInstance: null,
  gapsChartInstance: null,
};

// ── DOM Helpers ───────────────────────────────────────────────────────────
const $ = (id) => document.getElementById(id);
const $$ = (sel) => document.querySelectorAll(sel);

// ── Init ──────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", () => {
  checkHealth();
  initTabs();
  initResultsTabs();
  initForm();
  initChat();
  initUpload();
  initCharCounter();
});

// ── Health Check ──────────────────────────────────────────────────────────
async function checkHealth() {
  const badge = $("statusBadge");
  try {
    const res = await fetch("/api/health");
    const data = await res.json();
    if (!data.api_key_configured) {
      badge.textContent = "⚠ API Key Missing";
      badge.className = "status-badge status-error";
      showToast("GROQ_API_KEY is not set. Open research_agent/.env and add your key from console.groq.com", "error", 10000);
    } else if (!data.api_key_valid) {
      badge.textContent = "⚠ Invalid API Key";
      badge.className = "status-badge status-error";
      showToast(
        "❌ Invalid Groq API Key (401). Please:\n1. Go to console.groq.com → API Keys\n2. Create a new key\n3. Paste it in research_agent/.env as GROQ_API_KEY=your_key\n4. Restart the app",
        "error", 12000
      );
    } else {
      badge.textContent = "✓ API Ready";
      badge.className = "status-badge status-ok";
    }
  } catch {
    badge.textContent = "Offline";
    badge.className = "status-badge status-error";
  }
}

// ── Tab Navigation ────────────────────────────────────────────────────────
function initTabs() {
  $$(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.tab;
      $$(".tab-btn").forEach((b) => b.classList.remove("active"));
      $$(".tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      $(`tab-${tab}`).classList.add("active");
    });
  });
}

function initResultsTabs() {
  $$(".results-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const rtab = btn.dataset.rtab;
      $$(".results-tab-btn").forEach((b) => b.classList.remove("active"));
      $$(".results-tab-content").forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      $(`rtab-${rtab}`).classList.add("active");
    });
  });
}

// ── Character Counter ─────────────────────────────────────────────────────
function initCharCounter() {
  const topicInput = $("topic");
  const topicCount = $("topicCount");
  if (!topicInput) return;
  topicInput.addEventListener("input", () => {
    topicCount.textContent = `${topicInput.value.length}/300`;
    topicCount.style.color = topicInput.value.length > 270 ? "var(--warning)" : "var(--text-dim)";
  });
}

// ── Research Form ─────────────────────────────────────────────────────────
function initForm() {
  const form = $("researchForm");
  const analyzeBtn = $("analyzeBtn");
  const clearBtn = $("clearFormBtn");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const topic = $("topic").value.trim();
    if (!topic) {
      showToast("Please enter a research topic to continue.", "error");
      $("topic").focus();
      return;
    }
    await runAnalysis();
  });

  clearBtn.addEventListener("click", () => {
    form.reset();
    $("topicCount").textContent = "0/300";
    clearUploadedDocument();
    showInitialState();
  });

  $("clearUpload").addEventListener("click", clearUploadedDocument);
}

function getFormData() {
  return {
    topic: $("topic").value.trim(),
    domain: $("domain").value,
    keywords: $("keywords").value.trim(),
    objectives: $("objectives").value.trim(),
    notes: $("notes").value.trim(),
    uploaded_text: state.uploadedText,
  };
}

async function runAnalysis() {
  const formData = getFormData();

  // Update chat context
  state.chatContext = {
    topic: formData.topic,
    domain: formData.domain,
    keywords: formData.keywords,
  };

  showLoadingState("Analyzing your research topic...");
  animateLoadingSteps();

  try {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || "Analysis failed.");
    }

    state.lastAnalysis = data;

    // Display analysis
    showAnalysis(data);

    // Generate dashboard data
    await generateDashboard(data.analysis, formData.topic, formData.keywords);

  } catch (err) {
    showInitialState();
    showToast(err.message, "error");
  }
}

// ── Analysis Display ──────────────────────────────────────────────────────
function showAnalysis(data) {
  $("initialState").style.display = "none";
  $("loadingState").style.display = "none";
  $("resultsPanel").style.display = "flex";
  $("resultsPanel").style.flexDirection = "column";
  $("resultsPanel").style.height = "100%";

  // Set title and domain tag
  $("analysisTopicTitle").textContent = data.topic || "Research Analysis";
  const domainTag = $("analysisDomainTag");
  if (data.domain) {
    domainTag.textContent = data.domain;
    domainTag.style.display = "inline-block";
  } else {
    domainTag.style.display = "none";
  }

  // Render markdown
  const analysisEl = $("analysisContent");
  if (typeof marked !== "undefined") {
    marked.setOptions({ breaks: true, gfm: true });
    analysisEl.innerHTML = marked.parse(data.analysis || "No analysis returned.");
  } else {
    analysisEl.textContent = data.analysis || "No analysis returned.";
  }

  // Copy button
  $("copyAnalysisBtn").onclick = () => {
    navigator.clipboard.writeText(data.analysis || "").then(() => {
      showToast("Analysis copied to clipboard!", "success");
    });
  };

  // Switch to analysis tab
  activateResultsTab("analysis");
}

// ── Dashboard Generation ──────────────────────────────────────────────────
async function generateDashboard(analysisText, topic, keywords) {
  try {
    const res = await fetch("/api/dashboard", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analysis_text: analysisText, topic, keywords }),
    });

    const data = await res.json();
    if (!res.ok || data.error || !data.dashboard) {
      // Use fallback so tabs are never blank
      const fallback = buildFallbackDashboard(topic, keywords);
      state.dashboardData = fallback;
      renderDashboard(fallback);
      renderKnowledgeGraph(fallback);
      renderGapsTrends(fallback);
      return;
    }

    state.dashboardData = data.dashboard;
    renderDashboard(data.dashboard);
    renderKnowledgeGraph(data.dashboard);
    renderGapsTrends(data.dashboard);

  } catch (err) {
    console.warn("Dashboard generation failed:", err);
    const fallback = buildFallbackDashboard(topic, keywords);
    state.dashboardData = fallback;
    renderDashboard(fallback);
    renderKnowledgeGraph(fallback);
    renderGapsTrends(fallback);
  }
}

function buildFallbackDashboard(topic, keywords) {
  const kws = keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean).slice(0, 5) : [];
  return {
    key_concepts: [
      { id: 1, name: topic || "Research Topic", category: "domain", weight: 5 },
      { id: 2, name: "Literature Review", category: "methodology", weight: 4 },
      { id: 3, name: "Research Gaps", category: "theory", weight: 3 },
    ],
    concept_relationships: [
      { source: 1, target: 2, label: "informs" },
      { source: 2, target: 3, label: "reveals" },
    ],
    research_gaps: [{ gap: "See full analysis tab for identified gaps.", priority: "high" }],
    trends: [{ trend: "See full analysis tab for trend details.", direction: "emerging" }],
    suggested_search_terms: kws.length ? kws : ["research methodology", "literature review", "empirical study"],
    methodology_suggestions: ["Systematic Literature Review", "Empirical Study"],
    future_directions: ["See full analysis tab for future directions."],
    topic_clusters: [{ cluster: "Core Research", topics: [topic || "Research Topic"] }],
  };
}

function renderDashboard(d) {
  if (!d) return;

  // Render trends chart
  const trendsCanvas = $("trendsChart");
  if (d.trends && d.trends.length > 0) {
    if (state.trendsChartInstance) state.trendsChartInstance.destroy();
    const labels = d.trends.map((t) => truncateLabel(t.trend, 25));
    const colors = d.trends.map((t) =>
      t.direction === "emerging" ? "rgba(74,222,128,0.8)" :
      t.direction === "established" ? "rgba(91,141,238,0.8)" :
      "rgba(156,163,175,0.5)"
    );
    state.trendsChartInstance = new Chart(trendsCanvas, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Research Trend",
          data: labels.map((_, i) =>
            d.trends[i].direction === "emerging" ? 90 :
            d.trends[i].direction === "established" ? 70 : 40
          ),
          backgroundColor: colors,
          borderRadius: 6,
        }],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const t = d.trends[ctx.dataIndex];
                return ` ${t.direction.toUpperCase()}`;
              },
            },
          },
        },
        scales: {
          x: {
            display: false,
            max: 100,
          },
          y: {
            ticks: {
              color: "rgba(139,147,176,0.9)",
              font: { size: 11 },
            },
            grid: { color: "rgba(45,49,71,0.6)" },
          },
        },
      },
    });
  }

  // Render gaps chart
  const gapsCanvas = $("gapsChart");
  if (d.research_gaps && d.research_gaps.length > 0) {
    if (state.gapsChartInstance) state.gapsChartInstance.destroy();
    const gapLabels = d.research_gaps.map((g) => truncateLabel(g.gap, 22));
    const gapColors = d.research_gaps.map((g) =>
      g.priority === "high" ? "rgba(248,113,113,0.8)" :
      g.priority === "medium" ? "rgba(251,191,36,0.8)" :
      "rgba(91,141,238,0.8)"
    );
    state.gapsChartInstance = new Chart(gapsCanvas, {
      type: "doughnut",
      data: {
        labels: gapLabels,
        datasets: [{
          data: d.research_gaps.map((g) =>
            g.priority === "high" ? 3 : g.priority === "medium" ? 2 : 1
          ),
          backgroundColor: gapColors,
          borderWidth: 1,
          borderColor: "rgba(30,33,48,0.8)",
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: {
              color: "rgba(139,147,176,0.9)",
              font: { size: 10 },
              padding: 10,
              boxWidth: 10,
            },
          },
        },
        cutout: "55%",
      },
    });
  }

  // Keywords
  const keywordContainer = $("keywordTags");
  keywordContainer.innerHTML = "";
  if (d.suggested_search_terms) {
    d.suggested_search_terms.forEach((term) => {
      const tag = document.createElement("span");
      tag.className = "keyword-tag";
      tag.textContent = term;
      tag.title = "Click to copy";
      tag.onclick = () => {
        navigator.clipboard.writeText(term).then(() => showToast(`Copied: "${term}"`, "success", 2000));
      };
      keywordContainer.appendChild(tag);
    });
  }

  // Methodology
  const methList = $("methodologyList");
  methList.innerHTML = "";
  if (d.methodology_suggestions) {
    d.methodology_suggestions.forEach((m) => {
      const item = document.createElement("div");
      item.className = "dash-list-item";
      item.textContent = m;
      methList.appendChild(item);
    });
  }

  // Future Directions
  const futureList = $("futureDirectionsList");
  futureList.innerHTML = "";
  if (d.future_directions) {
    d.future_directions.forEach((f) => {
      const item = document.createElement("div");
      item.className = "dash-list-item";
      item.textContent = f;
      futureList.appendChild(item);
    });
  }

  // Topic Clusters
  const clusterContainer = $("topicClusters");
  clusterContainer.innerHTML = "";
  if (d.topic_clusters) {
    d.topic_clusters.forEach((cluster) => {
      const el = document.createElement("div");
      el.className = "topic-cluster";
      const nameEl = document.createElement("div");
      nameEl.className = "cluster-name";
      nameEl.textContent = cluster.cluster;
      const topicsEl = document.createElement("div");
      topicsEl.className = "cluster-topics";
      (cluster.topics || []).forEach((t) => {
        const tag = document.createElement("span");
        tag.className = "cluster-topic-tag";
        tag.textContent = t;
        topicsEl.appendChild(tag);
      });
      el.appendChild(nameEl);
      el.appendChild(topicsEl);
      clusterContainer.appendChild(el);
    });
  }
}

// ── Knowledge Graph (D3.js) ───────────────────────────────────────────────
function renderKnowledgeGraph(d) {
  if (!d || !d.key_concepts || d.key_concepts.length === 0) return;

  const container = $("knowledgeGraph");
  container.innerHTML = "";

  const width = container.clientWidth || 700;
  const height = container.clientHeight || 450;

  const colorMap = {
    methodology: "#5b8dee",
    theory: "#a78bfa",
    application: "#34d399",
    tool: "#fbbf24",
    domain: "#f87171",
  };

  const svg = d3.select(container)
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("viewBox", `0 0 ${width} ${height}`)
    .style("background", "transparent");

  // Arrow marker
  svg.append("defs").append("marker")
    .attr("id", "arrow")
    .attr("viewBox", "0 -5 10 10")
    .attr("refX", 20)
    .attr("refY", 0)
    .attr("markerWidth", 6)
    .attr("markerHeight", 6)
    .attr("orient", "auto")
    .append("path")
    .attr("d", "M0,-5L10,0L0,5")
    .attr("fill", "#363b55");

  const g = svg.append("g");

  // Zoom
  svg.call(
    d3.zoom()
      .scaleExtent([0.3, 3])
      .on("zoom", (event) => g.attr("transform", event.transform))
  );

  const nodes = d.key_concepts.map((c) => ({
    ...c,
    r: 14 + (c.weight || 1) * 4,
  }));

  // Build id→index map so D3 link source/target (integer ids) resolve correctly
  const idToIndex = {};
  nodes.forEach((n, i) => { idToIndex[n.id] = i; });

  const links = (d.concept_relationships || []).filter((rel) => {
    // Only keep links where both endpoints exist in the node list
    return idToIndex[rel.source] !== undefined && idToIndex[rel.target] !== undefined;
  }).map((rel) => ({
    source: idToIndex[rel.source],
    target: idToIndex[rel.target],
    label: rel.label || "",
  }));

  const simulation = d3.forceSimulation(nodes)
    .force("link", d3.forceLink(links).distance(120).strength(0.6))
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2))
    .force("collision", d3.forceCollide().radius((n) => n.r + 15));

  // Links
  const link = g.append("g")
    .selectAll("line")
    .data(links)
    .join("line")
    .attr("class", "kg-link")
    .attr("marker-end", "url(#arrow)");

  // Link labels
  const linkLabel = g.append("g")
    .selectAll("text")
    .data(links)
    .join("text")
    .attr("class", "kg-link-label")
    .text((d) => d.label);

  // Nodes
  const node = g.append("g")
    .selectAll("g")
    .data(nodes)
    .join("g")
    .attr("class", "kg-node")
    .call(
      d3.drag()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on("drag", (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null; d.fy = null;
        })
    );

  node.append("circle")
    .attr("r", (d) => d.r)
    .attr("fill", (d) => colorMap[d.category] || "#5b8dee")
    .attr("stroke", (d) => colorMap[d.category] || "#5b8dee")
    .attr("stroke-opacity", 0.4)
    .attr("fill-opacity", 0.85);

  node.append("text")
    .attr("text-anchor", "middle")
    .attr("dy", (d) => d.r + 14)
    .text((d) => truncateLabel(d.name, 20))
    .style("font-size", "10px")
    .style("fill", "rgba(232,234,240,0.85)");

  // Tooltip
  const tooltip = document.createElement("div");
  tooltip.className = "kg-tooltip";
  tooltip.style.display = "none";
  container.appendChild(tooltip);

  node.on("mouseover", (event, d) => {
    tooltip.style.display = "block";
    tooltip.textContent = `${d.name} (${d.category || "concept"})`;
  }).on("mousemove", (event) => {
    const rect = container.getBoundingClientRect();
    tooltip.style.left = (event.clientX - rect.left + 12) + "px";
    tooltip.style.top = (event.clientY - rect.top - 28) + "px";
  }).on("mouseout", () => {
    tooltip.style.display = "none";
  });

  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    linkLabel
      .attr("x", (d) => (d.source.x + d.target.x) / 2)
      .attr("y", (d) => (d.source.y + d.target.y) / 2);

    node.attr("transform", (d) => `translate(${d.x},${d.y})`);
  });
}

// ── Gaps & Trends Panel ───────────────────────────────────────────────────
function renderGapsTrends(d) {
  if (!d) return;

  // Gaps
  const gapsList = $("gapsList");
  gapsList.innerHTML = "";
  (d.research_gaps || []).forEach((g) => {
    const item = document.createElement("div");
    item.className = `gap-item ${g.priority === "medium" ? "medium" : g.priority === "low" ? "low" : ""}`;
    item.innerHTML = `<div class="gap-priority">${g.priority || "high"} priority</div>${escapeHtml(g.gap)}`;
    gapsList.appendChild(item);
  });

  // Trends
  const trendsList = $("trendsList");
  trendsList.innerHTML = "";
  (d.trends || []).forEach((t) => {
    const item = document.createElement("div");
    item.className = `trend-item ${t.direction === "established" ? "established" : t.direction === "declining" ? "declining" : ""}`;
    item.innerHTML = `<div class="trend-direction">${t.direction || "emerging"}</div>${escapeHtml(t.trend)}`;
    trendsList.appendChild(item);
  });

  // Future Directions
  const futureDetailed = $("futureDirectionsDetailed");
  futureDetailed.innerHTML = "";
  (d.future_directions || []).forEach((f) => {
    const item = document.createElement("div");
    item.className = "future-dir-item";
    item.textContent = f;
    futureDetailed.appendChild(item);
  });
}

// ── Loading State ─────────────────────────────────────────────────────────
function showLoadingState(msg = "Analyzing...") {
  $("initialState").style.display = "none";
  $("resultsPanel").style.display = "none";
  $("loadingState").style.display = "flex";
  $("loadingMessage").textContent = msg;

  // Reset steps
  ["step1", "step2", "step3", "step4"].forEach((id) => {
    $(id).className = "load-step";
  });
  $("step1").classList.add("active");
}

function animateLoadingSteps() {
  const steps = ["step1", "step2", "step3", "step4"];
  let i = 0;
  const interval = setInterval(() => {
    if (i > 0) {
      $(steps[i - 1]).className = "load-step done";
    }
    if (i < steps.length) {
      $(steps[i]).classList.add("active");
      i++;
    } else {
      clearInterval(interval);
    }
  }, 900);
}

function showInitialState() {
  $("initialState").style.display = "flex";
  $("loadingState").style.display = "none";
  $("resultsPanel").style.display = "none";
}

// ── Agent Chat ────────────────────────────────────────────────────────────
function initChat() {
  const sendBtn = $("sendChatBtn");
  const chatInput = $("chatInput");

  sendBtn.addEventListener("click", sendChatMessage);
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendChatMessage();
    }
  });

  // Quick prompts
  $$(".qp-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      chatInput.value = btn.dataset.prompt;
      chatInput.focus();
    });
  });
}

async function sendChatMessage() {
  const input = $("chatInput");
  const sendBtn = $("sendChatBtn");
  const query = input.value.trim();
  if (!query) return;

  // Disable send button while processing
  sendBtn.disabled = true;
  sendBtn.innerHTML = "<span>...</span>";

  // Append user message
  appendChatMessage("user", query);
  input.value = "";

  // Show typing indicator
  const typingId = appendTypingIndicator();

  try {
    const context = {
      topic: $("topic") ? $("topic").value.trim() : "",
      domain: $("domain") ? $("domain").value : "",
      keywords: $("keywords") ? $("keywords").value.trim() : "",
    };

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, context }),
    });

    const data = await res.json();
    removeTypingIndicator(typingId);

    if (!res.ok || data.error) {
      throw new Error(data.error || "Chat failed.");
    }

    appendChatMessage("assistant", data.response, data.web_search_used, data.web_results);

  } catch (err) {
    removeTypingIndicator(typingId);
    appendChatMessage("assistant", "Sorry, something went wrong: " + err.message);
  } finally {
    // Re-enable send button
    sendBtn.disabled = false;
    sendBtn.innerHTML = "<span>Send</span> ➤";
    input.focus();
  }
}

function appendChatMessage(role, text, webSearchUsed = false, webResults = []) {
  const container = $("chatMessages");

  const msgDiv = document.createElement("div");
  msgDiv.className = `chat-message ${role}-message`;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = role === "assistant" ? "🤖" : "👤";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";

  // 🌐 Web search badge
  if (role === "assistant" && webSearchUsed) {
    const badge = document.createElement("div");
    badge.className = "web-search-badge";
    badge.innerHTML = "🌐 <strong>Real-time web search used</strong> — answer grounded with live data";
    bubble.appendChild(badge);

    // Source links
    const validSources = (webResults || []).filter((r) => r.url);
    if (validSources.length > 0) {
      const sources = document.createElement("div");
      sources.className = "web-sources";
      sources.innerHTML = "<span class='sources-label'>Sources: </span>" +
        validSources.map((r) =>
          `<a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title || r.url)}</a>`
        ).join(" · ");
      bubble.appendChild(sources);
    }
  }

  const content = document.createElement("div");
  if (role === "assistant") {
    if (typeof marked !== "undefined") {
      try {
        marked.setOptions({ breaks: true, gfm: true });
        content.innerHTML = marked.parse(text);
      } catch(e) {
        content.innerHTML = text.replace(/\n/g, "<br>");
      }
    } else {
      content.innerHTML = text.replace(/\n/g, "<br>");
    }
  } else {
    content.textContent = text;
  }
  bubble.appendChild(content);

  // ── Feedback buttons (assistant only) ────────────────────
  if (role === "assistant") {
    const msgId = "msg_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    msgDiv.dataset.msgId = msgId;

    const feedbackRow = document.createElement("div");
    feedbackRow.className = "feedback-row";
    feedbackRow.innerHTML = `
      <span class="feedback-label">Was this helpful?</span>
      <button class="feedback-btn thumbs-up" data-id="${msgId}" data-val="up" title="Helpful">👍</button>
      <button class="feedback-btn thumbs-down" data-id="${msgId}" data-val="down" title="Not helpful">👎</button>
      <span class="feedback-thanks" id="ft_${msgId}" style="display:none">Thanks for your feedback!</span>
    `;
    feedbackRow.querySelectorAll(".feedback-btn").forEach(btn => {
      btn.addEventListener("click", () => sendFeedback(msgId, btn.dataset.val, text, feedbackRow));
    });
    bubble.appendChild(feedbackRow);
  }

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// ── Send Feedback to Backend ──────────────────────────────────────────────
async function sendFeedback(msgId, vote, responseText, feedbackRow) {
  // Immediately update UI
  feedbackRow.querySelectorAll(".feedback-btn").forEach(b => {
    b.disabled = true;
    b.classList.toggle("selected", b.dataset.val === vote);
  });
  const thanks = document.getElementById("ft_" + msgId);
  if (thanks) thanks.style.display = "inline";

  try {
    const lastUserMsg = (() => {
      const msgs = document.querySelectorAll(".user-message .msg-bubble");
      return msgs.length ? msgs[msgs.length - 1].textContent.trim() : "";
    })();

    await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        msg_id: msgId,
        vote,                        // "up" or "down"
        query: lastUserMsg,
        response: responseText,
        context: state.chatContext || {},
      }),
    });
  } catch (e) {
    // Feedback is best-effort — don't show error to user
    console.warn("Feedback send failed:", e);
  }
}

function appendTypingIndicator() {
  const container = $("chatMessages");
  const id = "typing_" + Date.now();

  const msgDiv = document.createElement("div");
  msgDiv.className = "chat-message assistant-message";
  msgDiv.id = id;

  const avatar = document.createElement("div");
  avatar.className = "msg-avatar";
  avatar.textContent = "🤖";

  const bubble = document.createElement("div");
  bubble.className = "msg-bubble";
  bubble.innerHTML = `<div class="typing-indicator">
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
    <div class="typing-dot"></div>
  </div>`;

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(bubble);
  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;

  return id;
}

function removeTypingIndicator(id) {
  const el = $(id);
  if (el) el.remove();
}

// ── File Upload ───────────────────────────────────────────────────────────
function initUpload() {
  const zone = $("uploadZone");
  const fileInput = $("fileInput");
  const browseBtn = $("browseBtn");

  browseBtn.addEventListener("click", () => fileInput.click());
  zone.addEventListener("click", (e) => {
    if (e.target !== browseBtn) fileInput.click();
  });

  fileInput.addEventListener("change", () => {
    if (fileInput.files[0]) processFile(fileInput.files[0]);
  });

  // Drag and drop
  zone.addEventListener("dragover", (e) => {
    e.preventDefault();
    zone.classList.add("drag-over");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("drag-over"));
  zone.addEventListener("drop", (e) => {
    e.preventDefault();
    zone.classList.remove("drag-over");
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });

  $("clearDocBtn").addEventListener("click", clearUploadedDocument);
  $("useInAnalysisBtn").addEventListener("click", () => {
    // Switch to research input tab
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    $$(".tab-content").forEach((c) => c.classList.remove("active"));
    document.querySelector('[data-tab="research-input"]').classList.add("active");
    $("tab-research-input").classList.add("active");
    showToast("Document added to research context. Click Analyze Research to proceed.", "success", 4000);
  });
}

async function processFile(file) {
  const allowedTypes = ["application/pdf", "text/plain", "text/markdown"];
  const allowedExts = [".pdf", ".txt", ".md"];
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();

  if (!allowedExts.includes(ext)) {
    showUploadStatus("Only PDF, TXT, and MD files are supported.", "error");
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    showUploadStatus("File too large. Maximum size is 10 MB.", "error");
    return;
  }

  showUploadStatus(`Uploading ${file.name}...`, "processing");

  const formData = new FormData();
  formData.append("file", file);

  try {
    const res = await fetch("/api/upload", {
      method: "POST",
      body: formData,
    });

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error(data.error || "Upload failed.");
    }

    state.uploadedText = data.extracted_text;
    state.uploadedFileName = data.filename;

    showUploadStatus(`✅ ${data.filename} processed (${data.word_count.toLocaleString()} words)`, "success");
    showDocumentContent(data);
    showUploadedPreview(data);

  } catch (err) {
    showUploadStatus(`Error: ${err.message}`, "error");
  }
}

function showUploadStatus(msg, type) {
  const el = $("uploadStatus");
  el.style.display = "block";
  el.className = `upload-status ${type}`;
  el.textContent = msg;
}

function showDocumentContent(data) {
  $("docFileName").textContent = data.filename;
  $("docWordCount").textContent = `${data.word_count.toLocaleString()} words`;
  $("docPreviewText").textContent = data.preview;
  $("documentContent").style.display = "block";
}

function showUploadedPreview(data) {
  $("uploadedFileName").textContent = data.filename;
  $("uploadedPreviewText").textContent = data.preview;
  $("uploadedTextPreview").style.display = "block";
}

function clearUploadedDocument() {
  state.uploadedText = "";
  state.uploadedFileName = "";
  $("uploadedTextPreview").style.display = "none";
  $("documentContent").style.display = "none";
  $("uploadStatus").style.display = "none";
  $("fileInput").value = "";
}

// ── Utilities ─────────────────────────────────────────────────────────────
function activateResultsTab(tabId) {
  $$(".results-tab-btn").forEach((b) => b.classList.remove("active"));
  $$(".results-tab-content").forEach((c) => c.classList.remove("active"));
  document.querySelector(`[data-rtab="${tabId}"]`).classList.add("active");
  $(`rtab-${tabId}`).classList.add("active");
}

function truncateLabel(text, maxLen = 30) {
  if (!text) return "";
  return text.length > maxLen ? text.substring(0, maxLen) + "…" : text;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showToast(message, type = "error", duration = 4000) {
  const existing = document.querySelector(".toast");
  if (existing) existing.remove();

  const toast = document.createElement("div");
  toast.className = `toast ${type === "success" ? "success" : ""}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.3s";
    setTimeout(() => toast.remove(), 300);
  }, duration);
}
