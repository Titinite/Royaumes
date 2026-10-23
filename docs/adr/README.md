# Registre des décisions d'architecture

Chaque décision d'architecture du projet est consignée dans un ADR, à partir du modèle
`template.md`. Un ADR accepté n'est jamais modifié sur le fond : si la décision évolue,
un nouvel ADR est rédigé et l'ancien prend le statut « remplacé ».

| N° | Décision | Statut |
| --- | --- | --- |
| [01](01-monolithe-modulaire.md) | Monolithe modulaire plutôt que microservices | Accepté |
| [02](02-event-sourcing-village.md) | Event Sourcing pour le Village | Accepté |
| [03](03-server-sent-events.md) | Server-Sent Events, alimentés par le journal, pour le temps réel | Accepté |
| [04](04-manches-simultanees.md) | Manches simultanées et échéances paresseuses pour le Donjon | Accepté |
| [05](05-intelligence-artificielle.md) | Intelligence artificielle déterministe, sans tâche de fond | Accepté |
| [06](06-cqrs-projections.md) | CQRS : modèles de lecture tenus par des projections rattrapées à la lecture | Accepté |
| [07](07-saga-boite-envoi.md) | Saga orchestrée et boîte d'envoi transactionnelle pour les opérations entre modules | Accepté |
| [08](08-donnees-personnelles.md) | Stockage classique pour la Taverne, et réécriture ciblée du journal pour l'effacement | Accepté |
| [09](09-extraction-village.md) | Extraction du Village en service autonome, préparée mais non déployée | Accepté |
| [10](10-quetes-stockage.md) | Module Quêtes : tables classiques tenues par une projection, et tirage déterministe | Accepté |
| [11](11-quetes-communication.md) | Communication des Quêtes : lecture du langage publié, et versement par la boîte d'envoi | Accepté |