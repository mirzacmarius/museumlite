export type EmailLocale = "en" | "fr" | "es" | "no" | "ro";

export interface EmailMessages {
  greeting: string;
  team: string;
  footerBrand: string;
  loanItemsFallback: string;
  loanDateUnavailable: string;
  loanAdditionalItems: { one: string; other: string };
  invitation: {
    subject: string;
    preview: string;
    invited: string;
    instructions: string;
    accept: string;
    copyLink: string;
    important: string;
    expires: string;
    decline: string;
    declineLink: string;
    footer: string;
  };
  loanApproved: {
    subject: string;
    preview: string;
    body: string;
    item: string;
    borrower: string;
    period: string;
    dateRange: string;
    view: string;
  };
  loanRejected: {
    subject: string;
    preview: string;
    body: string;
    item: string;
    borrower: string;
    period: string;
    dateRange: string;
    view: string;
  };
  loanPending: {
    subject: string;
    preview: string;
    body: string;
    item: string;
    borrower: string;
    period: string;
    dateRange: string;
    view: string;
  };
  taskAssigned: {
    subject: string;
    preview: string;
    body: string;
    task: string;
    assignedBy: string;
    dueDate: string;
    view: string;
  };
  subscriptionSuccess: {
    subject: string;
    preview: string;
    body: string;
    delight: string;
  };
  subscriptionError: {
    subject: string;
    preview: string;
    body: string;
    reassurance: string;
  };
  deletionGrace: {
    subject: string;
    preview: string;
    requested: string;
    continues: string;
    stop: string;
    transfer: string;
    footer: string;
  };
  deletionFinal: {
    subject: string;
    preview: string;
    scheduled: string;
    keep: string;
    stop: string;
    footer: string;
  };
  notification: {
    intro: string;
    open: string;
    manage: string;
    footer: string;
    categories: {
      approvals: string;
      reminders: string;
      alerts: string;
      assignments: string;
      system: string;
    };
  };
  digest: {
    subject: { daily: string; weekly: string };
    count: { one: string; other: string };
    intro: { daily: string; weekly: string };
    open: string;
    footer: { daily: string; weekly: string };
  };
  reproductionDelivery: {
    subject: string;
    intro: string;
    terms: string;
    expires: string;
    download: string;
    footer: string;
  };
  auth: {
    verificationSubject: string;
    verificationBody: string;
    magicLinkSubject: string;
    magicLinkBody: string;
    magicLinkCta: string;
    magicLinkIgnore: string;
    passwordSubject: string;
    passwordBody: string;
    emailChangeSubject: string;
    emailChangeBody: string;
    expires: string;
  };
}

const messages: Record<EmailLocale, EmailMessages> = {
  en: {
    greeting: "Hello {email},",
    team: "The MuseumLite team.",
    footerBrand: "MuseumLite",
    loanItemsFallback: "Loan items",
    loanDateUnavailable: "To be determined",
    loanAdditionalItems: {
      one: " and {count} other item",
      other: " and {count} other items",
    },
    invitation: {
      subject: "You've been invited to join {organizationName}",
      preview: "You've been invited to join {organizationName}",
      invited:
        "{inviterName} has invited you to join {organizationName} as a {role}.",
      instructions:
        "Use the button below to accept the invitation and get started.",
      accept: "Accept invitation",
      copyLink: "Or copy and paste this link into your browser:",
      important: "Important:",
      expires: "This invitation expires in 7 days.",
      decline: "If you don't want to join this organization, you can",
      declineLink: "decline the invitation",
      footer:
        "This invitation was sent to {email}. If you weren't expecting it, you can safely ignore this email.",
    },
    loanApproved: {
      subject: "Loan request approved",
      preview: "Loan request approved",
      body: "Your loan request has been approved.",
      item: "Item:",
      borrower: "Borrower:",
      period: "Loan period:",
      dateRange: "{startDate} to {endDate}",
      view: "View loan details",
    },
    loanRejected: {
      subject: "Loan request rejected",
      preview: "Loan request rejected",
      body: "We regret to inform you that your loan request has been rejected.",
      item: "Item:",
      borrower: "Borrower:",
      period: "Requested period:",
      dateRange: "{startDate} to {endDate}",
      view: "View loan details",
    },
    loanPending: {
      subject: "New loan request pending review",
      preview: "New loan request pending",
      body: "A new loan request has been submitted and is awaiting review.",
      item: "Item:",
      borrower: "Borrower:",
      period: "Requested period:",
      dateRange: "{startDate} to {endDate}",
      view: "Review loan request",
    },
    taskAssigned: {
      subject: "New task assigned",
      preview: "New task assigned",
      body: "You have been assigned a new task.",
      task: "Task:",
      assignedBy: "Assigned by:",
      dueDate: "Due date:",
      view: "View task details",
    },
    subscriptionSuccess: {
      subject: "Your PRO subscription is active",
      preview: "Successfully subscribed to PRO",
      body: "Your subscription to PRO has been successfully processed.",
      delight: "We hope you enjoy the new features!",
    },
    subscriptionError: {
      subject: "Subscription issue — customer support",
      preview: "Subscription issue — customer support",
      body: "We were unable to process your subscription to PRO.",
      reassurance:
        "You won't be charged. Please contact support if you need help.",
    },
    deletionGrace: {
      subject: "Deletion requested for {organizationName}",
      preview: "Your organization deletion request for {organizationName}",
      requested:
        "You requested deletion of {organizationName}. The organization is now inactive while we wait for your confirmation.",
      continues:
        "If you do nothing, the deletion process will continue after {date}.",
      stop: "Stop deletion",
      transfer:
        "You can also transfer ownership to another member from organization settings before the account is removed.",
      footer: "This message was sent to {email} regarding {organizationName}.",
    },
    deletionFinal: {
      subject: "Final notice: {organizationName} will be deleted",
      preview: "Final notice: {organizationName} will be deleted soon",
      scheduled:
        "Your organization {organizationName} is scheduled for permanent deletion on {date}.",
      keep: "To keep this account, stop the deletion now or transfer ownership to another team member.",
      stop: "Stop deletion",
      footer: "This final notice was sent to {email} for {organizationName}.",
    },
    notification: {
      intro: "There is a new notification for you in {organizationName}:",
      open: "Open in MuseumLite",
      manage: "Change which notifications you receive by email",
      footer:
        "You receive this email because email is on for {category} notifications in {organizationName}.",
      categories: {
        approvals: "Approvals",
        reminders: "Reminders",
        alerts: "Alerts",
        assignments: "Tasks",
        system: "System",
      },
    },
    digest: {
      subject: {
        daily: "Your daily digest from {organizationName}: {count}",
        weekly: "Your weekly digest from {organizationName}: {count}",
      },
      count: { one: "{count} notification", other: "{count} notifications" },
      intro: {
        daily: "Here is your daily digest of {count} in {organizationName}.",
        weekly: "Here is your weekly digest of {count} in {organizationName}.",
      },
      open: "Open your notifications",
      footer: {
        daily:
          "You receive this digest because you chose a daily email digest for notifications in {organizationName}.",
        weekly:
          "You receive this digest because you chose a weekly email digest for notifications in {organizationName}.",
      },
    },
    reproductionDelivery: {
      subject: "Your image from {organizationName} ({requestNumber})",
      intro:
        "{organizationName} approved your request {requestNumber} for {objectLabel}. The file is a copy prepared for your request, not the original.",
      terms: "Terms of use: {termsTitle}, version {termsVersion}",
      expires:
        "The download link works until {date}. It stops working earlier if the licence is revoked.",
      download: "Download the image",
      footer:
        "You received this email because you asked {organizationName} to use one of its images.",
    },
    auth: {
      verificationSubject: "Your MuseumLite verification code",
      verificationBody: "Your verification code is {token}.",
      magicLinkSubject: "Sign in to MuseumLite",
      magicLinkBody: "Use this secure link to sign in to MuseumLite.",
      magicLinkCta: "Sign in to MuseumLite",
      magicLinkIgnore:
        "If you did not request this email, you can safely ignore it.",
      passwordSubject: "Reset your MuseumLite password",
      passwordBody: "Your password reset code is {token}.",
      emailChangeSubject: "Verify your MuseumLite email address",
      emailChangeBody: "Your email change verification code is {token}.",
      expires: "This code expires in 20 minutes.",
    },
  },
  fr: {
    greeting: "Bonjour {email},",
    team: "L’équipe MuseumLite.",
    footerBrand: "MuseumLite",
    loanItemsFallback: "Objets du prêt",
    loanDateUnavailable: "À déterminer",
    loanAdditionalItems: {
      one: " et {count} autre objet",
      other: " et {count} autres objets",
    },
    invitation: {
      subject: "Vous êtes invité à rejoindre {organizationName}",
      preview: "Vous êtes invité à rejoindre {organizationName}",
      invited:
        "{inviterName} vous invite à rejoindre {organizationName} en tant que {role}.",
      instructions:
        "Utilisez le bouton ci-dessous pour accepter l’invitation et commencer.",
      accept: "Accepter l’invitation",
      copyLink:
        "Vous pouvez aussi copier et coller ce lien dans votre navigateur :",
      important: "Important :",
      expires: "Cette invitation expire dans 7 jours.",
      decline:
        "Si vous ne souhaitez pas rejoindre cette organisation, vous pouvez",
      declineLink: "refuser l’invitation",
      footer:
        "Cette invitation a été envoyée à {email}. Si vous ne l’attendiez pas, vous pouvez ignorer cet e-mail en toute sécurité.",
    },
    loanApproved: {
      subject: "Demande de prêt approuvée",
      preview: "Demande de prêt approuvée",
      body: "Votre demande de prêt a été approuvée.",
      item: "Objet :",
      borrower: "Emprunteur :",
      period: "Période du prêt :",
      dateRange: "du {startDate} au {endDate}",
      view: "Voir les détails du prêt",
    },
    loanRejected: {
      subject: "Demande de prêt refusée",
      preview: "Demande de prêt refusée",
      body: "Nous sommes au regret de vous informer que votre demande de prêt a été refusée.",
      item: "Objet :",
      borrower: "Emprunteur :",
      period: "Période demandée :",
      dateRange: "du {startDate} au {endDate}",
      view: "Voir les détails du prêt",
    },
    loanPending: {
      subject: "Nouvelle demande de prêt en attente d’examen",
      preview: "Nouvelle demande de prêt en attente",
      body: "Une nouvelle demande de prêt a été soumise et attend son examen.",
      item: "Objet :",
      borrower: "Emprunteur :",
      period: "Période demandée :",
      dateRange: "du {startDate} au {endDate}",
      view: "Examiner la demande de prêt",
    },
    taskAssigned: {
      subject: "Nouvelle tâche attribuée",
      preview: "Nouvelle tâche attribuée",
      body: "Une nouvelle tâche vous a été attribuée.",
      task: "Tâche :",
      assignedBy: "Attribuée par :",
      dueDate: "Échéance :",
      view: "Voir les détails de la tâche",
    },
    subscriptionSuccess: {
      subject: "Votre abonnement PRO est actif",
      preview: "Abonnement PRO activé",
      body: "Votre abonnement PRO a bien été activé.",
      delight:
        "Nous espérons que vous apprécierez les nouvelles fonctionnalités !",
    },
    subscriptionError: {
      subject: "Problème d’abonnement — assistance client",
      preview: "Problème d’abonnement — assistance client",
      body: "Nous n’avons pas pu traiter votre abonnement PRO.",
      reassurance:
        "Aucun montant ne vous sera facturé. Contactez l’assistance si vous avez besoin d’aide.",
    },
    deletionGrace: {
      subject: "Demande de suppression pour {organizationName}",
      preview:
        "Demande de suppression de votre organisation {organizationName}",
      requested:
        "Vous avez demandé la suppression de {organizationName}. L’organisation est désormais inactive dans l’attente de votre confirmation.",
      continues:
        "Sans action de votre part, la procédure de suppression se poursuivra après le {date}.",
      stop: "Arrêter la suppression",
      transfer:
        "Vous pouvez également transférer la propriété à un autre membre depuis les paramètres de l’organisation avant la suppression du compte.",
      footer:
        "Ce message concernant {organizationName} a été envoyé à {email}.",
    },
    deletionFinal: {
      subject: "Dernier avis : {organizationName} sera supprimée",
      preview: "Dernier avis : {organizationName} sera bientôt supprimée",
      scheduled:
        "La suppression définitive de votre organisation {organizationName} est prévue le {date}.",
      keep: "Pour conserver ce compte, arrêtez la suppression ou transférez la propriété à un autre membre de l’équipe.",
      stop: "Arrêter la suppression",
      footer:
        "Ce dernier avis concernant {organizationName} a été envoyé à {email}.",
    },
    notification: {
      intro: "Vous avez une nouvelle notification dans {organizationName} :",
      open: "Ouvrir dans MuseumLite",
      manage: "Choisir les notifications reçues par e-mail",
      footer:
        "Vous recevez cet e-mail car l’e-mail est activé pour les notifications {category} dans {organizationName}.",
      categories: {
        approvals: "Approbations",
        reminders: "Rappels",
        alerts: "Alertes",
        assignments: "Tâches",
        system: "Système",
      },
    },
    digest: {
      subject: {
        daily: "Votre récapitulatif quotidien de {organizationName} : {count}",
        weekly:
          "Votre récapitulatif hebdomadaire de {organizationName} : {count}",
      },
      count: { one: "{count} notification", other: "{count} notifications" },
      intro: {
        daily:
          "Voici votre récapitulatif quotidien de {count} dans {organizationName}.",
        weekly:
          "Voici votre récapitulatif hebdomadaire de {count} dans {organizationName}.",
      },
      open: "Ouvrir vos notifications",
      footer: {
        daily:
          "Vous recevez ce récapitulatif car vous avez choisi un récapitulatif quotidien par e-mail des notifications de {organizationName}.",
        weekly:
          "Vous recevez ce récapitulatif car vous avez choisi un récapitulatif hebdomadaire par e-mail des notifications de {organizationName}.",
      },
    },
    reproductionDelivery: {
      subject: "Votre image de {organizationName} ({requestNumber})",
      intro:
        "{organizationName} a approuvé votre demande {requestNumber} pour {objectLabel}. Le fichier est une copie préparée pour votre demande, et non l'original.",
      terms: "Conditions d'utilisation : {termsTitle}, version {termsVersion}",
      expires:
        "Le lien de téléchargement fonctionne jusqu'au {date}. Il cesse de fonctionner plus tôt si la licence est révoquée.",
      download: "Télécharger l'image",
      footer:
        "Vous recevez cet e-mail parce que vous avez demandé à {organizationName} d'utiliser l'une de ses images.",
    },
    auth: {
      verificationSubject: "Votre code de vérification MuseumLite",
      verificationBody: "Votre code de vérification est {token}.",
      magicLinkSubject: "Connexion à MuseumLite",
      magicLinkBody:
        "Utilisez ce lien sécurisé pour vous connecter à MuseumLite.",
      magicLinkCta: "Se connecter à MuseumLite",
      magicLinkIgnore:
        "Si vous n’avez pas demandé cet e-mail, vous pouvez l’ignorer en toute sécurité.",
      passwordSubject: "Réinitialisez votre mot de passe MuseumLite",
      passwordBody:
        "Votre code de réinitialisation du mot de passe est {token}.",
      emailChangeSubject: "Vérifiez votre adresse e-mail MuseumLite",
      emailChangeBody:
        "Votre code de vérification du changement d’adresse e-mail est {token}.",
      expires: "Ce code expire dans 20 minutes.",
    },
  },
  es: {
    greeting: "Hola {email},",
    team: "El equipo de MuseumLite.",
    footerBrand: "MuseumLite",
    loanItemsFallback: "Objetos del préstamo",
    loanDateUnavailable: "Por determinar",
    loanAdditionalItems: {
      one: " y {count} artículo más",
      other: " y {count} artículos más",
    },
    invitation: {
      subject: "Te han invitado a unirte a {organizationName}",
      preview: "Te han invitado a unirte a {organizationName}",
      invited:
        "{inviterName} te ha invitado a unirte a {organizationName} como {role}.",
      instructions:
        "Usa el botón siguiente para aceptar la invitación y empezar.",
      accept: "Aceptar invitación",
      copyLink: "También puedes copiar y pegar este enlace en el navegador:",
      important: "Importante:",
      expires: "Esta invitación caduca en 7 días.",
      decline: "Si no quieres unirte a esta organización, puedes",
      declineLink: "rechazar la invitación",
      footer:
        "Esta invitación se envió a {email}. Si no la esperabas, puedes ignorar este correo con seguridad.",
    },
    loanApproved: {
      subject: "Solicitud de préstamo aprobada",
      preview: "Solicitud de préstamo aprobada",
      body: "Se ha aprobado tu solicitud de préstamo.",
      item: "Objeto:",
      borrower: "Prestatario:",
      period: "Período del préstamo:",
      dateRange: "del {startDate} al {endDate}",
      view: "Ver detalles del préstamo",
    },
    loanRejected: {
      subject: "Solicitud de préstamo rechazada",
      preview: "Solicitud de préstamo rechazada",
      body: "Lamentamos informarte de que se ha rechazado tu solicitud de préstamo.",
      item: "Objeto:",
      borrower: "Prestatario:",
      period: "Período solicitado:",
      dateRange: "del {startDate} al {endDate}",
      view: "Ver detalles del préstamo",
    },
    loanPending: {
      subject: "Nueva solicitud de préstamo pendiente de revisión",
      preview: "Nueva solicitud de préstamo pendiente",
      body: "Se ha enviado una nueva solicitud de préstamo y está pendiente de revisión.",
      item: "Objeto:",
      borrower: "Prestatario:",
      period: "Período solicitado:",
      dateRange: "del {startDate} al {endDate}",
      view: "Revisar solicitud de préstamo",
    },
    taskAssigned: {
      subject: "Nueva tarea asignada",
      preview: "Nueva tarea asignada",
      body: "Se te ha asignado una nueva tarea.",
      task: "Tarea:",
      assignedBy: "Asignada por:",
      dueDate: "Fecha límite:",
      view: "Ver detalles de la tarea",
    },
    subscriptionSuccess: {
      subject: "Tu suscripción PRO está activa",
      preview: "Suscripción a PRO completada",
      body: "Tu suscripción a PRO se ha procesado correctamente.",
      delight: "¡Esperamos que disfrutes de las nuevas funciones!",
    },
    subscriptionError: {
      subject: "Problema con la suscripción — atención al cliente",
      preview: "Problema con la suscripción — atención al cliente",
      body: "No hemos podido procesar tu suscripción a PRO.",
      reassurance:
        "No se te cobrará nada. Contacta con soporte si necesitas ayuda.",
    },
    deletionGrace: {
      subject: "Solicitud de eliminación de {organizationName}",
      preview: "Solicitud para eliminar tu organización {organizationName}",
      requested:
        "Has solicitado eliminar {organizationName}. La organización está inactiva mientras esperamos tu confirmación.",
      continues:
        "Si no haces nada, el proceso de eliminación continuará después del {date}.",
      stop: "Detener eliminación",
      transfer:
        "También puedes transferir la propiedad a otro miembro desde la configuración de la organización antes de que se elimine la cuenta.",
      footer: "Este mensaje sobre {organizationName} se envió a {email}.",
    },
    deletionFinal: {
      subject: "Aviso final: se eliminará {organizationName}",
      preview: "Aviso final: {organizationName} se eliminará pronto",
      scheduled:
        "La eliminación permanente de tu organización {organizationName} está programada para el {date}.",
      keep: "Para conservar esta cuenta, detén ahora la eliminación o transfiere la propiedad a otro miembro del equipo.",
      stop: "Detener eliminación",
      footer: "Este aviso final sobre {organizationName} se envió a {email}.",
    },
    notification: {
      intro: "Tienes una nueva notificación en {organizationName}:",
      open: "Abrir en MuseumLite",
      manage: "Elegir qué notificaciones recibes por correo",
      footer:
        "Recibes este correo porque el correo está activado para las notificaciones de {category} en {organizationName}.",
      categories: {
        approvals: "Aprobaciones",
        reminders: "Recordatorios",
        alerts: "Alertas",
        assignments: "Tareas",
        system: "Sistema",
      },
    },
    digest: {
      subject: {
        daily: "Tu resumen diario de {organizationName}: {count}",
        weekly: "Tu resumen semanal de {organizationName}: {count}",
      },
      count: { one: "{count} notificación", other: "{count} notificaciones" },
      intro: {
        daily: "Este es tu resumen diario con {count} en {organizationName}.",
        weekly: "Este es tu resumen semanal con {count} en {organizationName}.",
      },
      open: "Abrir tus notificaciones",
      footer: {
        daily:
          "Recibes este resumen porque elegiste un resumen diario por correo de las notificaciones de {organizationName}.",
        weekly:
          "Recibes este resumen porque elegiste un resumen semanal por correo de las notificaciones de {organizationName}.",
      },
    },
    reproductionDelivery: {
      subject: "Su imagen de {organizationName} ({requestNumber})",
      intro:
        "{organizationName} aprobó su solicitud {requestNumber} para {objectLabel}. El archivo es una copia preparada para su solicitud, no el original.",
      terms: "Condiciones de uso: {termsTitle}, versión {termsVersion}",
      expires:
        "El enlace de descarga funciona hasta el {date}. Deja de funcionar antes si se revoca la licencia.",
      download: "Descargar la imagen",
      footer:
        "Recibe este correo porque pidió a {organizationName} usar una de sus imágenes.",
    },
    auth: {
      verificationSubject: "Tu código de verificación de MuseumLite",
      verificationBody: "Tu código de verificación es {token}.",
      magicLinkSubject: "Iniciar sesión en MuseumLite",
      magicLinkBody:
        "Usa este enlace seguro para iniciar sesión en MuseumLite.",
      magicLinkCta: "Iniciar sesión en MuseumLite",
      magicLinkIgnore:
        "Si no solicitaste este correo, puedes ignorarlo con seguridad.",
      passwordSubject: "Restablece tu contraseña de MuseumLite",
      passwordBody: "Tu código para restablecer la contraseña es {token}.",
      emailChangeSubject: "Verifica tu dirección de correo de MuseumLite",
      emailChangeBody:
        "Tu código para verificar el cambio de correo es {token}.",
      expires: "Este código caduca en 20 minutos.",
    },
  },
  no: {
    greeting: "Hei {email},",
    team: "MuseumLite-teamet.",
    footerBrand: "MuseumLite",
    loanItemsFallback: "Låneobjekter",
    loanDateUnavailable: "Fastsettes senere",
    loanAdditionalItems: {
      one: " og {count} gjenstand til",
      other: " og {count} andre gjenstander",
    },
    invitation: {
      subject: "Du er invitert til {organizationName}",
      preview: "Du er invitert til {organizationName}",
      invited:
        "{inviterName} har invitert deg til {organizationName} som {role}.",
      instructions:
        "Bruk knappen nedenfor for å godta invitasjonen og komme i gang.",
      accept: "Godta invitasjonen",
      copyLink: "Du kan også kopiere og lime inn denne lenken i nettleseren:",
      important: "Viktig:",
      expires: "Invitasjonen utløper om 7 dager.",
      decline: "Hvis du ikke vil bli med i denne organisasjonen, kan du",
      declineLink: "avslå invitasjonen",
      footer:
        "Invitasjonen ble sendt til {email}. Hvis du ikke ventet den, kan du trygt se bort fra e-posten.",
    },
    loanApproved: {
      subject: "Lånesøknaden er godkjent",
      preview: "Lånesøknaden er godkjent",
      body: "Lånesøknaden din er godkjent.",
      item: "Objekt:",
      borrower: "Låntaker:",
      period: "Låneperiode:",
      dateRange: "{startDate} til {endDate}",
      view: "Vis lånedetaljer",
    },
    loanRejected: {
      subject: "Lånesøknaden er avslått",
      preview: "Lånesøknaden er avslått",
      body: "Vi beklager å måtte informere om at lånesøknaden din er avslått.",
      item: "Objekt:",
      borrower: "Låntaker:",
      period: "Ønsket periode:",
      dateRange: "{startDate} til {endDate}",
      view: "Vis lånedetaljer",
    },
    loanPending: {
      subject: "Ny lånesøknad venter på behandling",
      preview: "Ny lånesøknad venter",
      body: "En ny lånesøknad er sendt inn og venter på behandling.",
      item: "Objekt:",
      borrower: "Låntaker:",
      period: "Ønsket periode:",
      dateRange: "{startDate} til {endDate}",
      view: "Behandle lånesøknaden",
    },
    taskAssigned: {
      subject: "Ny oppgave tildelt",
      preview: "Ny oppgave tildelt",
      body: "Du har fått tildelt en ny oppgave.",
      task: "Oppgave:",
      assignedBy: "Tildelt av:",
      dueDate: "Frist:",
      view: "Vis oppgavedetaljer",
    },
    subscriptionSuccess: {
      subject: "PRO-abonnementet er aktivt",
      preview: "PRO-abonnementet er aktivert",
      body: "PRO-abonnementet ditt er behandlet.",
      delight: "Vi håper du får glede av de nye funksjonene!",
    },
    subscriptionError: {
      subject: "Problem med abonnementet — kundestøtte",
      preview: "Problem med abonnementet — kundestøtte",
      body: "Vi kunne ikke behandle PRO-abonnementet ditt.",
      reassurance:
        "Du blir ikke belastet. Kontakt kundestøtte hvis du trenger hjelp.",
    },
    deletionGrace: {
      subject: "Sletting er forespurt for {organizationName}",
      preview: "Forespørsel om sletting av organisasjonen {organizationName}",
      requested:
        "Du har bedt om å slette {organizationName}. Organisasjonen er nå inaktiv mens vi venter på bekreftelsen din.",
      continues: "Hvis du ikke gjør noe, fortsetter slettingen etter {date}.",
      stop: "Stopp slettingen",
      transfer:
        "Du kan også overføre eierskapet til et annet medlem i organisasjonsinnstillingene før kontoen fjernes.",
      footer: "Denne meldingen om {organizationName} ble sendt til {email}.",
    },
    deletionFinal: {
      subject: "Siste varsel: {organizationName} blir slettet",
      preview: "Siste varsel: {organizationName} blir snart slettet",
      scheduled:
        "Organisasjonen {organizationName} skal slettes permanent {date}.",
      keep: "Hvis du vil beholde kontoen, må du stoppe slettingen nå eller overføre eierskapet til et annet teammedlem.",
      stop: "Stopp slettingen",
      footer:
        "Dette siste varselet om {organizationName} ble sendt til {email}.",
    },
    notification: {
      intro: "Du har et nytt varsel i {organizationName}:",
      open: "Åpne i MuseumLite",
      manage: "Velg hvilke varsler du får på e-post",
      footer:
        "Du får denne e-posten fordi e-post er slått på for varsler om {category} i {organizationName}.",
      categories: {
        approvals: "Godkjenninger",
        reminders: "Påminnelser",
        alerts: "Advarsler",
        assignments: "Oppgaver",
        system: "System",
      },
    },
    digest: {
      subject: {
        daily: "Ditt daglige sammendrag fra {organizationName}: {count}",
        weekly: "Ditt ukentlige sammendrag fra {organizationName}: {count}",
      },
      count: { one: "{count} varsel", other: "{count} varsler" },
      intro: {
        daily:
          "Her er ditt daglige sammendrag med {count} i {organizationName}.",
        weekly:
          "Her er ditt ukentlige sammendrag med {count} i {organizationName}.",
      },
      open: "Åpne varslene dine",
      footer: {
        daily:
          "Du får dette sammendraget fordi du har valgt et daglig sammendrag på e-post for varsler i {organizationName}.",
        weekly:
          "Du får dette sammendraget fordi du har valgt et ukentlig sammendrag på e-post for varsler i {organizationName}.",
      },
    },
    reproductionDelivery: {
      subject: "Bildet ditt fra {organizationName} ({requestNumber})",
      intro:
        "{organizationName} har godkjent forespørselen din {requestNumber} for {objectLabel}. Filen er en kopi laget for forespørselen din, ikke originalen.",
      terms: "Bruksvilkår: {termsTitle}, versjon {termsVersion}",
      expires:
        "Nedlastingslenken virker til {date}. Den slutter å virke tidligere hvis lisensen trekkes tilbake.",
      download: "Last ned bildet",
      footer:
        "Du får denne e-posten fordi du ba {organizationName} om å bruke et av bildene deres.",
    },
    auth: {
      verificationSubject: "Din bekreftelseskode for MuseumLite",
      verificationBody: "Bekreftelseskoden din er {token}.",
      magicLinkSubject: "Logg inn på MuseumLite",
      magicLinkBody: "Bruk denne sikre lenken for å logge inn på MuseumLite.",
      magicLinkCta: "Logg inn på MuseumLite",
      magicLinkIgnore:
        "Hvis du ikke ba om denne e-posten, kan du trygt se bort fra den.",
      passwordSubject: "Tilbakestill MuseumLite-passordet",
      passwordBody: "Koden for tilbakestilling av passord er {token}.",
      emailChangeSubject: "Bekreft MuseumLite-e-postadressen din",
      emailChangeBody: "Koden for bekreftelse av e-postendring er {token}.",
      expires: "Koden utløper om 20 minutter.",
    },
  },
  ro: {
    greeting: "Bună, {email},",
    team: "Echipa MuseumLite.",
    footerBrand: "MuseumLite",
    loanItemsFallback: "Obiectele împrumutului",
    loanDateUnavailable: "De stabilit",
    loanAdditionalItems: {
      one: " și încă {count} obiect",
      other: " și încă {count} obiecte",
    },
    invitation: {
      subject: "Ați fost invitat să vă alăturați {organizationName}",
      preview: "Ați fost invitat să vă alăturați {organizationName}",
      invited:
        "{inviterName} v-a invitat să vă alăturați {organizationName} în rolul de {role}.",
      instructions:
        "Folosiți butonul de mai jos pentru a accepta invitația și a începe.",
      accept: "Acceptați invitația",
      copyLink: "Puteți copia și lipi acest link în browser:",
      important: "Important:",
      expires: "Invitația expiră în 7 zile.",
      decline: "Dacă nu doriți să vă alăturați acestei organizații, puteți",
      declineLink: "refuza invitația",
      footer:
        "Invitația a fost trimisă la {email}. Dacă nu o așteptați, puteți ignora acest e-mail în siguranță.",
    },
    loanApproved: {
      subject: "Cererea de împrumut a fost aprobată",
      preview: "Cererea de împrumut a fost aprobată",
      body: "Cererea dvs. de împrumut a fost aprobată.",
      item: "Obiect:",
      borrower: "Împrumutat:",
      period: "Perioada împrumutului:",
      dateRange: "de la {startDate} până la {endDate}",
      view: "Vedeți detaliile împrumutului",
    },
    loanRejected: {
      subject: "Cererea de împrumut a fost respinsă",
      preview: "Cererea de împrumut a fost respinsă",
      body: "Ne pare rău să vă informăm că cererea dvs. de împrumut a fost respinsă.",
      item: "Obiect:",
      borrower: "Împrumutat:",
      period: "Perioada solicitată:",
      dateRange: "de la {startDate} până la {endDate}",
      view: "Vedeți detaliile împrumutului",
    },
    loanPending: {
      subject: "O nouă cerere de împrumut așteaptă verificarea",
      preview: "O nouă cerere de împrumut este în așteptare",
      body: "A fost trimisă o nouă cerere de împrumut, care așteaptă verificarea.",
      item: "Obiect:",
      borrower: "Împrumutat:",
      period: "Perioada solicitată:",
      dateRange: "de la {startDate} până la {endDate}",
      view: "Verificați cererea de împrumut",
    },
    taskAssigned: {
      subject: "A fost atribuită o sarcină nouă",
      preview: "A fost atribuită o sarcină nouă",
      body: "V-a fost atribuită o sarcină nouă.",
      task: "Sarcină:",
      assignedBy: "Atribuită de:",
      dueDate: "Termen-limită:",
      view: "Vedeți detaliile sarcinii",
    },
    subscriptionSuccess: {
      subject: "Abonamentul PRO este activ",
      preview: "Abonamentul PRO a fost activat",
      body: "Abonamentul dvs. PRO a fost procesat cu succes.",
      delight: "Sperăm să vă bucurați de noile funcții!",
    },
    subscriptionError: {
      subject: "Problemă cu abonamentul — asistență clienți",
      preview: "Problemă cu abonamentul — asistență clienți",
      body: "Nu am putut procesa abonamentul dvs. PRO.",
      reassurance:
        "Nu vi se va percepe nicio taxă. Contactați serviciul de asistență dacă aveți nevoie de ajutor.",
    },
    deletionGrace: {
      subject: "S-a solicitat ștergerea organizației {organizationName}",
      preview: "Solicitarea de ștergere a organizației {organizationName}",
      requested:
        "Ați solicitat ștergerea organizației {organizationName}. Organizația este acum inactivă până la confirmarea dvs.",
      continues:
        "Dacă nu luați nicio măsură, procesul de ștergere va continua după {date}.",
      stop: "Opriți ștergerea",
      transfer:
        "Puteți transfera proprietatea către un alt membru din setările organizației înainte ca acest cont să fie eliminat.",
      footer: "Acest mesaj despre {organizationName} a fost trimis la {email}.",
    },
    deletionFinal: {
      subject: "Notificare finală: {organizationName} va fi ștearsă",
      preview: "Notificare finală: {organizationName} va fi ștearsă în curând",
      scheduled:
        "Ștergerea permanentă a organizației {organizationName} este programată pentru {date}.",
      keep: "Pentru a păstra acest cont, opriți acum ștergerea sau transferați proprietatea către un alt membru al echipei.",
      stop: "Opriți ștergerea",
      footer:
        "Această notificare finală despre {organizationName} a fost trimisă la {email}.",
    },
    notification: {
      intro: "Aveți o notificare nouă în {organizationName}:",
      open: "Deschideți în MuseumLite",
      manage: "Alegeți ce notificări primiți prin e-mail",
      footer:
        "Primiți acest e-mail deoarece e-mailul este activat pentru notificările de tip {category} în {organizationName}.",
      categories: {
        approvals: "Aprobări",
        reminders: "Mementouri",
        alerts: "Alerte",
        assignments: "Sarcini",
        system: "Sistem",
      },
    },
    digest: {
      subject: {
        daily: "Rezumatul zilnic din {organizationName}: {count}",
        weekly: "Rezumatul săptămânal din {organizationName}: {count}",
      },
      count: { one: "{count} notificare", other: "{count} notificări" },
      intro: {
        daily: "Iată rezumatul zilnic cu {count} din {organizationName}.",
        weekly: "Iată rezumatul săptămânal cu {count} din {organizationName}.",
      },
      open: "Deschideți notificările",
      footer: {
        daily:
          "Primiți acest rezumat deoarece ați ales un rezumat zilnic prin e-mail al notificărilor din {organizationName}.",
        weekly:
          "Primiți acest rezumat deoarece ați ales un rezumat săptămânal prin e-mail al notificărilor din {organizationName}.",
      },
    },
    reproductionDelivery: {
      subject: "Imaginea dvs. de la {organizationName} ({requestNumber})",
      intro:
        "{organizationName} a aprobat cererea dvs. {requestNumber} pentru {objectLabel}. Fișierul este o copie pregătită pentru cererea dvs., nu originalul.",
      terms: "Condiții de utilizare: {termsTitle}, versiunea {termsVersion}",
      expires:
        "Linkul de descărcare funcționează până la {date}. Nu mai funcționează mai devreme dacă licența este revocată.",
      download: "Descărcați imaginea",
      footer:
        "Primiți acest e-mail deoarece ați cerut organizației {organizationName} să folosească una dintre imaginile sale.",
    },
    auth: {
      verificationSubject: "Codul dvs. de verificare MuseumLite",
      verificationBody: "Codul dvs. de verificare este {token}.",
      magicLinkSubject: "Autentificare în MuseumLite",
      magicLinkBody:
        "Folosiți acest link securizat pentru a vă autentifica în MuseumLite.",
      magicLinkCta: "Autentificare în MuseumLite",
      magicLinkIgnore:
        "Dacă nu ați solicitat acest e-mail, îl puteți ignora în siguranță.",
      passwordSubject: "Resetați parola MuseumLite",
      passwordBody: "Codul pentru resetarea parolei este {token}.",
      emailChangeSubject: "Verificați adresa de e-mail MuseumLite",
      emailChangeBody:
        "Codul pentru verificarea schimbării adresei este {token}.",
      expires: "Codul expiră în 20 de minute.",
    },
  },
};

export function getEmailTranslations(locale?: string): EmailMessages {
  switch (locale) {
    case "fr":
    case "es":
    case "no":
    case "ro":
      return messages[locale];
    default:
      return messages.en;
  }
}

export function interpolateEmailText(
  template: string,
  values: Record<string, string | number>,
): string {
  return template.replace(/\{([^{}]+)\}/g, (_, key: string) =>
    String(values[key] ?? `{${key}}`),
  );
}

export function getEmailLocaleFromAuthUrl(url: string): EmailLocale {
  let firstPathSegment: string | undefined;
  try {
    firstPathSegment = new URL(url, "http://localhost").pathname
      .split("/")
      .filter(Boolean)[0];
  } catch {
    return "en";
  }
  switch (firstPathSegment) {
    case "fr":
    case "es":
    case "no":
    case "ro":
      return firstPathSegment;
    case "en":
      return "en";
    default:
      return "en";
  }
}

export function escapeEmailHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildAuthCodeEmail({
  locale,
  subject,
  body,
  token,
  additionalMessage,
}: {
  locale: EmailLocale;
  subject: string;
  body: string;
  token: string;
  additionalMessage?: string;
}): { subject: string; html: string; text: string } {
  const content = interpolateEmailText(body, { token });
  const htmlMessage = escapeEmailHtml(body).replaceAll(
    "{token}",
    `<strong>${escapeEmailHtml(token)}</strong>`,
  );
  const htmlAdditional = additionalMessage
    ? `<p>${escapeEmailHtml(additionalMessage)}</p>`
    : "";
  const textContent = additionalMessage
    ? `${content} ${additionalMessage}`
    : content;

  return {
    subject,
    html: `<html lang="${locale}"><body><p>${htmlMessage}</p>${htmlAdditional}</body></html>`,
    text: textContent,
  };
}
