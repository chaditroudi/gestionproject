INSERT INTO users (full_name, email, password_hash, role)
VALUES
  ('Admin Principal', 'admin@company.com', crypt('Admin123!', gen_salt('bf')), 'admin'),
  ('Nadia Directrice', 'director@company.com', crypt('Director123!', gen_salt('bf')), 'director'),
  ('Sarra Manager', 'manager@company.com', crypt('Manager123!', gen_salt('bf')), 'manager'),
  ('Youssef Team Lead', 'lead@company.com', crypt('Lead123!', gen_salt('bf')), 'team_lead'),
  ('Imen RH', 'hr@company.com', crypt('Hr12345!', gen_salt('bf')), 'hr'),
  ('Ali Employe', 'employee@company.com', crypt('Employee123!', gen_salt('bf')), 'employee');

INSERT INTO teams (name, description, manager_id)
VALUES
  ('Equipe Produit', 'Conception et priorisation du produit', 3),
  ('Equipe Technique', 'Developpement et maintenance de la plateforme', 4),
  ('Equipe Support', 'Support interne et experience collaborateur', 5);

INSERT INTO team_members (team_id, user_id)
VALUES
  (1, 2),
  (1, 3),
  (1, 6),
  (2, 3),
  (2, 4),
  (2, 6),
  (3, 4),
  (3, 5),
  (3, 6);

INSERT INTO tasks (title, description, status, priority, due_date, team_id, assignee_id, creator_id)
VALUES
  ('Definir le backlog initial', 'Recenser les besoins fonctionnels prioritaires', 'done', 'high', CURRENT_DATE + INTERVAL '2 days', 1, 3, 1),
  ('Concevoir le schema de base de donnees', 'Modeliser les utilisateurs, equipes et taches', 'in_progress', 'high', CURRENT_DATE + INTERVAL '5 days', 2, 4, 2),
  ('Mettre en place le tableau de bord', 'Afficher les indicateurs de suivi de projet', 'todo', 'medium', CURRENT_DATE + INTERVAL '7 days', 2, 6, 3),
  ('Valider la securite des acces', 'Verifier les roles et permissions API', 'blocked', 'high', CURRENT_DATE + INTERVAL '10 days', 2, 5, 1),
  ('Optimiser le parcours collaborateur', 'Fluidifier la creation de compte et la gestion des equipes', 'in_progress', 'medium', CURRENT_DATE + INTERVAL '4 days', 3, 6, 5);

INSERT INTO tasks (title, description, status, priority, due_date, parent_task_id, team_id, assignee_id, creator_id)
VALUES
  ('Structurer les widgets KPI', 'Definir les cartes et indicateurs du dashboard', 'in_progress', 'medium', CURRENT_DATE + INTERVAL '3 days', 3, 2, 4, 3),
  ('Ajouter les filtres de reporting', 'Permettre un filtrage par statut et equipe', 'todo', 'low', CURRENT_DATE + INTERVAL '5 days', 3, 2, 6, 3);

INSERT INTO task_comments (task_id, author_id, content)
VALUES
  (3, 3, 'Nous avons besoin d''un premier prototype avant vendredi. @lead'),
  (3, 4, 'Je prends la partie visuelle et je reviendrai avec une proposition.'),
  (2, 2, 'Pensez a documenter les relations de collaboration des taches.');

INSERT INTO task_comment_mentions (comment_id, user_id)
VALUES
  (1, 4);

INSERT INTO task_checklist_items (task_id, title, is_completed, completed_by, completed_at, created_by)
VALUES
  (3, 'Definir les KPI a afficher', TRUE, 3, NOW(), 3),
  (3, 'Maquetter la section des graphiques', FALSE, NULL, NULL, 4),
  (2, 'Verifier les indexes PostgreSQL', FALSE, NULL, NULL, 2);

INSERT INTO task_activity_logs (task_id, actor_id, action_type, message, metadata)
VALUES
  (3, 3, 'task_created', 'Tache creee dans l''equipe Technique.', '{"status":"todo"}'),
  (3, 4, 'comment_added', 'Un commentaire a ete ajoute a la tache.', '{"commentId":2}'),
  (3, 3, 'checklist_updated', 'Une etape de checklist a ete completee.', '{"itemId":1}');

INSERT INTO task_attachments (task_id, label, url, uploaded_by)
VALUES
  (3, 'Maquette dashboard', 'https://example.com/mockup-dashboard', 4),
  (2, 'Notes schema', 'https://example.com/schema-notes', 2);
