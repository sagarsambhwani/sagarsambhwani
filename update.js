const fs = require("fs");

const USER = process.env.GITHUB_REPOSITORY_OWNER || "sagarsambhwani";
const TOKEN = process.env.GITHUB_TOKEN;

const FALLBACK_DESCRIPTIONS = {
    "RetrievLAB": "Experimental evaluation framework and benchmark suite for Information Retrieval & RAG systems.",
    "Nexus-ML": "Modular machine learning pipeline framework for automated model orchestration and feature engineering.",
    "Immersed": "Immersive AI & web application exploring interactive LLM experiences and spatial UI."
};

async function github(url) {
    const headers = {
        Accept: "application/vnd.github+json",
        "User-Agent": "profile-updater"
    };
    if (TOKEN) {
        headers.Authorization = `Bearer ${TOKEN}`;
    }

    const res = await fetch(`https://api.github.com${url}`, { headers });
    return await res.json();
}

async function getLatestCommit(repoName) {
    try {
        const commits = await github(`/repos/${USER}/${repoName}/commits?per_page=1`);
        if (Array.isArray(commits) && commits.length > 0) {
            const commitObj = commits[0].commit;
            const message = commitObj.message ? commitObj.message.split("\n")[0] : "";
            const date = commitObj.committer ? commitObj.committer.date : (commitObj.author ? commitObj.author.date : null);
            return { message, date };
        }
    } catch (e) {
        console.error(`Failed to fetch commit for ${repoName}:`, e);
    }
    return null;
}

(async () => {
    try {
        let allRepos = await github(`/users/${USER}/repos?per_page=100`);

        if (!Array.isArray(allRepos)) {
            console.error("Failed to fetch repositories:", allRepos);
            process.exit(1);
        }

        const nonForkRepos = allRepos.filter(
            r => !r.fork && r.name.toLowerCase() !== USER.toLowerCase()
        );

        // 1. Calculate top languages across repositories
        const langCounts = {};
        nonForkRepos.forEach(r => {
            if (r.language) {
                langCounts[r.language] = (langCounts[r.language] || 0) + 1;
            }
        });

        const sortedLangs = Object.entries(langCounts)
            .sort((a, b) => b[1] - a[1])
            .map(([lang]) => lang);

        const detectedLanguagesStr = sortedLangs.length > 0
            ? sortedLangs.join(", ")
            : "Python, Go, SQL, JavaScript";

        // 2. Select top 3 active repositories
        const liveRepos = [...nonForkRepos]
            .sort((a, b) => new Date(b.pushed_at) - new Date(a.pushed_at))
            .slice(0, 3);

        let liveProjectsMd = "";
        for (let i = 0; i < liveRepos.length; i++) {
            const repo = liveRepos[i];
            const desc = repo.description || FALLBACK_DESCRIPTIONS[repo.name] || "No description";
            const commitInfo = await getLatestCommit(repo.name);

            let commitDateStr = repo.pushed_at ? repo.pushed_at.slice(0, 10) : "";
            if (commitInfo && commitInfo.date) {
                const d = new Date(commitInfo.date);
                commitDateStr = d.toISOString().replace("T", " ").slice(0, 16) + " UTC";
            }

            liveProjectsMd += `### ${i + 1}. [${repo.name}](${repo.html_url})\n`;
            liveProjectsMd += `${desc}\n\n`;
            liveProjectsMd += `⭐ ${repo.stargazers_count} | 🕒 Updated: ${commitDateStr}\n`;
            if (commitInfo && commitInfo.message) {
                liveProjectsMd += `💬 **Latest commit:** \`${commitInfo.message}\`\n`;
            }
            liveProjectsMd += `\n`;
        }

        // 3. Format Tech Stack section
        const techStackMd = `- **Languages (Most Used):** ${detectedLanguagesStr}\n` +
            `- **AI/ML:** LangChain, LangGraph, Generative AI, Autonomous Agents\n` +
            `- **Data Engineering:** dbt, Databricks, MongoDB, SQL\n` +
            `- **DevOps/Tools:** Docker, KitOps, Git, GitHub Actions`;

        let readme = fs.readFileSync("README.md", "utf8");

        // Update Live Projects
        readme = readme.replace(
            /<!-- LIVE_PROJECTS_START -->([\s\S]*?)<!-- LIVE_PROJECTS_END -->/,
            `<!-- LIVE_PROJECTS_START -->\n${liveProjectsMd.trim()}\n<!-- LIVE_PROJECTS_END -->`
        );

        // Update Tech Stack
        readme = readme.replace(
            /<!-- TECH_STACK_START -->([\s\S]*?)<!-- TECH_STACK_END -->/,
            `<!-- TECH_STACK_START -->\n${techStackMd}\n<!-- TECH_STACK_END -->`
        );

        fs.writeFileSync("README.md", readme);
        console.log("Successfully updated README.md with live projects & tech stack!");
    } catch (err) {
        console.error("Error updating profile:", err);
        process.exit(1);
    }
})();
