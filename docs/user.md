# Users
1 User type is available: DOMUser.

User object is made every time new client entered( in standalone mode only one client enters).
## DOMUser
DOMUser has one useful method.

### ondrag
ondrag takes callback:

    user.ondrag(function(from,to){
        // ...
    });

`from` and `to` are **game objects**.

This method requires `draggable`,`dropzone` arrtibute of their nodes set properly using ClientDOMView.
