CREATE TABLE IF NOT EXISTS rewards.badges (
    id          VARCHAR(50) PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    description VARCHAR(255) NOT NULL,
    icon_emoji  VARCHAR(10)  NOT NULL,
    category    VARCHAR(50)  NOT NULL,
    threshold   INTEGER      NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS rewards.profile_badges (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id  UUID        NOT NULL,
    badge_id    VARCHAR(50) NOT NULL REFERENCES rewards.badges(id),
    earned_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(profile_id, badge_id)
);

CREATE INDEX idx_pb_profile ON rewards.profile_badges(profile_id);

-- Seed badge definitions
INSERT INTO rewards.badges VALUES
('FIRST_TASK',    'First Steps',       'Completed your first task!',               '⭐', 'TASKS',    1),
('TASK_5',        'Task Warrior',      'Completed 5 tasks!',                        '🏆', 'TASKS',    5),
('TASK_10',       'Task Champion',     'Completed 10 tasks — you rock!',            '🥇', 'TASKS',   10),
('TASK_25',       'Task Master',       'Completed 25 tasks. Incredible!',           '👑', 'TASKS',   25),
('STREAK_3',      '3-Day Streak',      'Completed tasks 3 days in a row!',          '🔥', 'STREAK',   3),
('STREAK_7',      'Week Warrior',      '7-day task streak. Amazing!',               '⚡', 'STREAK',   7),
('POINTS_100',    'Century Club',      'Earned 100 points!',                        '💯', 'TASKS',  100),
('POINTS_500',    'High Achiever',     'Earned 500 points! You are on fire!',       '🚀', 'TASKS',  500),
('SAFE_WEEK',     'Safe Surfer',       'A whole week with no blocked sites!',       '🛡️', 'SAFETY',   7),
('CHECKIN_10',    'Always Here',       'Checked in with your family 10 times!',     '📍', 'SAFETY',  10),
('FIRST_REWARD',  'Reward Collector',  'Redeemed your first reward!',               '🎁', 'TASKS',    1),
('LEARNING_CHAT', 'Curious Mind',      'Had 10 chats with the Learning Buddy!',     '🧠', 'LEARNING',10)
ON CONFLICT DO NOTHING;

GRANT ALL ON rewards.badges TO shield;
GRANT ALL ON rewards.profile_badges TO shield;
