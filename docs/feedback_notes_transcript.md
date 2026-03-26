# Notes on turing game feedback (to be enriched with analysis results)

Thu, 26 Mar 26

### Retroalimentación General de la Prueba de Turing

- Evaluación de limitantes de IA en todas las dimensiones
- Dinámica requería contacto mediado entre IA y testigo humano
- Participantes compartían contexto social/socioeconómico similar
  - Grupo social relativamente cercano
  - Edades similares en muchos casos
- Claude carecía de contexto completo a pesar de intentos de proporcionarlo

### Limitantes Principales Identificadas

- Coloquialismos y expresiones cotidianas
  - IA no familiarizada con lenguaje del día a día
  - Hablaba con expresiones características pero faltaba capa adicional
- Estrategias de engaño del humano
  - Decir prematuramente que el juego terminó
  - Pedir información que solo IA suele proveer
- Mejoras implementadas en instrucciones y premisas
  - Retroalimentación sobre coloquialismos
  - Contramedidas para estrategias de engaño

### Aspectos Técnicos y Limitaciones

- Necesidad de mediador con contexto compartido
  - Diferente al juego en línea aleatorio
  - Límites espaciales, no temporales
- Problemas técnicos identificados:
  - Claude no sabía hora/día
  - Falló contexto temporal crítico

### Recomendaciones y Mejoras Futuras

- Dinámicas de intercambio de mensajes:
  - Interrogador siempre inicia conversación
  - No puede enviar hasta recibir respuesta
  - Coordinar llegada simultánea de mensajes
- Expansión de knowledge base y lecciones
- Implementar más dinámicas de juego sin que el interrogador sepa qué dinámica es:
  1. Interrogador vs dos humanos
  2. Interrogador vs dos IAs
  3. Configuración tradicional mejorada
- Limitación actual: siempre un humano + una IA
  - Participantes informados de posibles combinaciones
  - Evidente por compartir un solo enlace


# Raw feedback transcript
Meeting Title: Retro turing game
Date: Mar 26

Transcript:
 
Me:  Esto es la retroalimentación general para esta aplicación de pruebas de Turing. Evalúa sus limitantes en intenta evaluar sus limitantes en todas las dimensiones. La dinámica del juego implicaba que los tuviera cierto tipo de contacto aunque sea por un mediador. Este, entre el entre el entre el el entre y el y el y el testigo humano. Entonces, implicaba que, pues, comparten algo de y algo de y algo en sus vidas. No son completos desconocidos, por más que estén aislados y no sepan uno quién es quién. Siguen perteneciendo este, a a, pues, un grupo social relativamente cercano a una realidad socioeconómica cercana Posiblemente, en muchos casos sucedió que a a edades cercanas. Por lo tanto, este, pues ese contexto no lo tenía completo Claude. La inteligencia artificial, por más que eso lo intentamos dar, nunca lo tuvo por completo. Limitante fuerte relacionado a esto son los, o sea, fue los coloquialismos. Este, y expresiones del día a día de las cuales Claude no está, y en inteligencia artificial no está al tanto. Por lo general hablaba, sí hablaba con expresiones, este, pues muy características del de de como el pero, pues, al final del día, hacía falta una capa más. Este, en cuanto a más limitantes del contexto ahí del análisis que se hizo sobre las lecciones, y Este, creo que la la la capa de de compound de compounding y de ir mejorando las, este, las premisas y las instrucciones para la instancia de inteligencia artificial sí sí mejoraron básicamente. Este, hasta hasta recibió retroalimentación en como ciertos coloquialismos francés para evitar También ciertas también recibió retroalimentación a contra estrategias del humano que intentan engañar a la inteligencia artificial. En el que le dice prematuramente que el juego ya acabó, en el que él pide, este, él pide información que solo inteligencia artificial suele proveer, etcétera, etcétera. Cuanto aspectos técnicos del juego, pues ya se mencionó como que la necesidad de que tiene que haber un mediador, pero los comparten cierto contexto los dos jugadores. No es como el juego en línea famoso del theory game, en el que te conectas al azar con un número de cualquier parte del mundo aquí, tus afino yafts. Hay hay como límites temporales y, digo, hay límites espaciales, no temporales. Siete, limitación técnica, y estos y estas son que tienen accionables, se pueden mejorar muchísimo, es, por ejemplo, la hora del día y el mensaje nunca se presentan los mensajes. Por lo tanto, Claude no sabe qué hora es y qué día es, y eso muchas veces le falló en el contexto. Entonces, agregar una instancia, dieron a agregar que que el mensaje que le llega a además tenga la hora del día. Es, este, la hora día y el día, la temporada es, este, muy relevante. ¿Qué más? Me puedes, o es como una empresa clave de contexto. También la interacción, la la la API de cloud, servicio de API, no permite que le mandes dos mensajes a cloud, entonces tuvimos que deshabilitar que el pueda mandar dos mensajes a este chat. Y después de varios juegos, como interrogador, el pretendía que el mensaje, si quiere, si no le podía mandar mandándole mensaje a un jugador, que era inteligencia artificial es el jugador. Este, suerte no fue una una limitante tan fuerte, solo pasó una vez con con muchos juegos juegos repetidos para un solo interrogador, ¿no?, con como tres, cuatro. Este, pero deberíamos de también la la dinámica de respuesta, porque también hubo un rato que la instancia de de de clic en artificial constaba demasiado rápido. Una sugerencia es, este, que que los mensajes, o sea, que que que primero de los mensajes está intercalado siempre. Empieza siempre el interrogador en la conversación, y no puede volver a mandar un mensaje hasta recibir una respuesta del del otro. Luego también coordinarlo para que lleguen los dos mensajes al mismo tiempo. O sea, el juego no le presenta al interrogador, mensajes hasta que las dos los dos chats, los dos jugadores, es decir, la inteligencia artificial y el jugador humano, los dos hayan contestado así. Elementos como el tiempo de respuesta, no afectan. Pues también es un aspecto menos que que ayuda a la inteligencia artificial. Más allá de esos aspectos técnicos, esto la retroalimentación para para el juego. Y cosas si se pueden, para que se se puede extender el knowledge base este, y y extender las lecciones en y, bueno, la mejora mayor y que, lamentablemente, hay que mencionar que no nos dio tiempo de implementar. Es encontrar cómo implementar más dinámicas de juego. Este, o sea, que exista la manera de generar juego entre un interrogador y dos humanos. Que también exista la manera de, no sé, de un interrogador y los instancias de artificial, o la tradicional o la ayudo. Este, pero eso le le agregaría una capa de oportunidad y y y y y, bueno, le nos ayudaría a evaluar los resultados mucho mejor. Esos resultados están profundamente limitados. Pues esto porque este, siempre hay un humano y una especie de inteligencia artificial. Lo que sí se hizo, sin embargo, es el informara a cada participante del juego este, antes de cada cada interrogadora, ¿no?, se le informara que podían estar hablando con dos humanos, dos instancias de inteligencia artificial o con un AIU. Ya usted se les dijo, pero al final del día, por por el hecho de que solo compartían un un un enlace, un link, pues, era muy evidente que que se no el caso. Este, y, bueno, hasta ahí la la recomendación para el drinking. 