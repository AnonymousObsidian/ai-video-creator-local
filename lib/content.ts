export function makeScript(topic: string, sourceText = "") {
  const subject = topic.trim() || "your next big idea";
  const source = sourceText.trim();
  const points = source
    ? source.split(/[\n.!?]+/).map((part) => part.trim()).filter((part) => part.length > 12).slice(0, 4)
    : [];
  const body = points.length
    ? points.map((point, index) => `Scene ${index + 1}: ${point}.`).join("\n\n")
    : `Scene 1: Here's what you need to know about ${subject}.\n\nScene 2: Start with the essentials, then focus on what makes the biggest difference.\n\nScene 3: Put these ideas into practice and see the results for yourself.`;
  return `Hook: Curious about ${subject}? Here's a quick guide.\n\n${body}\n\nClosing: Save this video and follow for more.`;
}

export function makeSeo(topic: string, platform: string) {
  const subject = topic.trim() || "your next big idea";
  const title = `${subject}: A Quick Guide`;
  const words = subject.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const keywords = [...new Set([...words, "how to", "tips", "guide", "explained"])];
  return {
    mode: "offline-template",
    platform,
    title,
    description: `Discover the essentials of ${subject}. Watch this quick guide for practical ideas you can use today.`,
    hashtags: [...new Set(["#"+words.slice(0, 2).join(""), "#VideoTips", "#LearnSomething", "#Creator"])],
    keywords,
    tags: keywords.slice(0, 10),
    caption: `Here's your quick guide to ${subject}. Save this for later!`,
    suggestions: [
      "Put the main topic near the beginning of the title.",
      "Use a custom thumbnail with one clear focal point.",
      "Add accurate captions and relevant, specific keywords.",
    ],
  };
}

export function makeLaunchScript(name: string, description: string, language: string, readme: string) {
  const projectName = name.trim() || "this project";
  const summary = description.trim() || `an open-source project called ${projectName}`;
  const tech = language ? ` built with ${language}` : "";
  const excerpt = readme
    .split(/\r?\n/)
    .map((line) => line.replace(/^#+\s*/, "").replace(/[`*_>#]/g, "").trim())
    .filter((line) => line.length > 28 && line.length < 180 && !/^https?:\/\//i.test(line))
    .slice(0, 3);
  const proof = excerpt.length
    ? excerpt.map((line, index) => `Scene ${index + 2}: ${line}`).join("\n\n")
    : `Scene 2: Explore the project, see how it works, and discover what you can build with it.`;
  return `Hook: Looking for a fresh way to ${projectName}? Take a look.\n\nScene 1: Meet ${projectName}, ${summary}${tech}.\n\n${proof}\n\nClosing: Explore the repository, try it out, and share what you build.`;
}
